require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { execFile, fork } = require('node:child_process');
const { promisify } = require('node:util');
const { setTimeout: esperar } = require('node:timers/promises');
const { ConfigService } = require('@nestjs/config');
const { DataSource } = require('typeorm');
const amqp = require('amqplib');
const entidades = require('../src/database/entities');
const { BandejaRepository } = require('../src/modules/bandeja/bandeja.repository');
const { ReclamosRepository } = require('../src/modules/reclamos/reclamos.repository');
const { OutboxRepository } = require('../src/core/mensajeria/outbox.repository');
const { Outbox1793361600000 } = require('../src/database/migrations/1793361600000-Outbox');
const { EmailRepository } = require('../src/modules/email/email.repository');
const { RabbitClient } = require('../src/core/mensajeria/rabbit.client');
const { PublicadorEventos } = require('../src/core/mensajeria/publicador-eventos');
const { DlqClient } = require('../src/core/mensajeria/dlq.client');
const { DlqService } = require('../src/core/mensajeria/dlq.service');
const { crearSobre } = require('../src/core/mensajeria/eventos');
const { colaMuerta, EXCHANGE, declararCola } = require('../src/core/mensajeria/topologia');
const ejecutar = promisify(execFile);
const compose = ['compose', '-f', require('node:path').join(__dirname, 'compose.yml')];

function exigir(nombre) {
  assert.ok(process.env[nombre], `Falta ${nombre}; ver documentación de aceptación`);
  return process.env[nombre];
}

function local(nombre) {
  const valor = exigir(nombre);
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(valor).hostname), `${nombre} debe apuntar al entorno local aislado`);
  return valor;
}

async function hasta(accion, limite = 15_000) {
  const inicio = Date.now();
  while (Date.now() - inicio < limite) {
    const valor = await accion();
    if (valor) return valor;
    await esperar(100);
  }
  assert.fail(`No se observó el resultado esperado en ${limite} ms`);
}

test('C3/C5: deduplicación concurrente y rollback con PostgreSQL real', { timeout: 30_000 }, async (t) => {
  const url = local('ACEPTACION_DATABASE_URL');
  assert.equal(new URL(url).pathname, '/domus_aceptacion');
  const schema = `aceptacion_${randomUUID().replaceAll('-', '')}`;
  // Metadata real, sin synchronize: el esquema mínimo solo verifica el contrato
  // transaccional de bandeja. No pretende replicar todo Supabase.
  const opciones = { type: 'postgres', url, entities: Object.values(entidades).filter((e) => typeof e === 'function'), synchronize: false, extra: { options: `-c search_path=${schema},public` } };
  let db = new DataSource(opciones);
  await db.initialize();
  try {
    await db.query(`CREATE SCHEMA "${schema}"`);
    await db.query(`CREATE TABLE "${schema}".evento_procesado (evento_id uuid NOT NULL, consumidor text NOT NULL, PRIMARY KEY (evento_id, consumidor))`);
    await db.query(`CREATE TABLE "${schema}".notificacion (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), usuario_id uuid NOT NULL,
      titulo varchar(150) NOT NULL, cuerpo text, tipo text NOT NULL,
      entidad_tipo varchar(40), entidad_id uuid, leida_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now())`);
    const repo = () => new BandejaRepository(db.getRepository(entidades.Notificacion));
    const eventoId = randomUUID();
    const usuarioId = randomUUID();
    const aviso = { titulo: 'Aceptación', cuerpo: null, tipo: entidades.TipoNotificacion.NOVEDAD, entidadTipo: null, entidadId: null };
    await t.test('diez entregas simultáneas producen una sola notificación', async () => {
      const resultados = await Promise.all(Array.from({ length: 10 }, () => repo().guardar(eventoId, [usuarioId], aviso)));
      assert.equal(resultados.filter(Boolean).length, 1);
      assert.equal(Number((await db.query('SELECT count(*) FROM notificacion'))[0].count), 1);
    });
    await t.test('la deduplicación persiste al reconstruir conexión y repository', async () => {
      await db.destroy();
      db = await new DataSource(opciones).initialize();
      assert.equal(await repo().guardar(eventoId, [usuarioId], aviso), false);
      assert.equal(Number((await db.query('SELECT count(*) FROM notificacion'))[0].count), 1);
    });
    await t.test('fallo después de registrar evento revierte marca y efecto; permite reintento', async () => {
      const fallido = randomUUID();
      await assert.rejects(repo().guardar(fallido, [usuarioId], { ...aviso, titulo: 'x'.repeat(151) }));
      assert.equal(Number((await db.query('SELECT count(*) FROM evento_procesado WHERE evento_id=$1', [fallido]))[0].count), 0);
      assert.equal(Number((await db.query('SELECT count(*) FROM notificacion'))[0].count), 1);
      assert.equal(await repo().guardar(fallido, [usuarioId], aviso), true);
      assert.equal(Number((await db.query('SELECT count(*) FROM notificacion'))[0].count), 2);
    });
    await t.test('C5: error al guardar timeline revierte el cambio de estado del reclamo', async () => {
      await db.query(`CREATE TABLE reclamo (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), codigo varchar(20) UNIQUE,
        consorcio_id uuid, unidad_id uuid, creado_por uuid, categoria_id uuid,
        proveedor_id uuid, descripcion text, prioridad text DEFAULT 'MEDIA',
        estado text DEFAULT 'NUEVO', cerrado_at timestamptz,
        created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), titulo varchar(80))`);
      await db.query(`CREATE TABLE reclamo_evento (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reclamo_id uuid, autor_id uuid,
        tipo text, mensaje text, estado_anterior text, estado_nuevo text,
        visible_para_vecino boolean DEFAULT true, created_at timestamptz DEFAULT now(), proveedor_id uuid)`);
      await db.query(`CREATE FUNCTION "${schema}".fallar_timeline() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'fallo inducido de timeline'; END $$`);
      await db.query(`CREATE TRIGGER fallo_timeline BEFORE INSERT ON reclamo_evento FOR EACH ROW EXECUTE FUNCTION "${schema}".fallar_timeline()`);
      const id = randomUUID();
      await db.query('INSERT INTO reclamo(id, codigo, descripcion) VALUES ($1,$2,$3)', [id, 'RC-PRUEBA', 'Estado anterior']);
      const reclamo = await db.getRepository(entidades.Reclamo).findOneByOrFail({ id });
      reclamo.estado = entidades.EstadoReclamo.RESUELTO;
      const repository = new ReclamosRepository(db.getRepository(entidades.Reclamo), db.getRepository(entidades.ReclamoEvento), db.getRepository(entidades.UnidadUsuario), db.getRepository(entidades.Unidad), db);
      await assert.rejects(repository.actualizarConEvento(reclamo, {
        reclamoId: id, autorId: randomUUID(), tipo: entidades.TipoEventoReclamo.CREACION,
      }), /fallo inducido de timeline/);
      const [persistido] = await db.query('SELECT estado FROM reclamo WHERE id=$1', [id]);
      assert.equal(persistido.estado, 'NUEVO');
      assert.equal(Number((await db.query('SELECT count(*) FROM reclamo_evento'))[0].count), 0);
    });
    await t.test('C3 email: reserva durable única y bloqueo del reenvío incierto', async () => {
      await db.query(`CREATE TABLE envio_notificacion (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), canal text, destinatario varchar(150),
        plantilla varchar(60), payload jsonb DEFAULT '{}', estado text DEFAULT 'PENDIENTE',
        intentos smallint DEFAULT 0, ultimo_error text, entidad_tipo varchar(40), entidad_id uuid,
        enviado_at timestamptz, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now())`);
      const datos = { canal: entidades.CanalNotificacion.EMAIL, destinatario: 'prueba@example.test', plantilla: 'aviso.directo', entidadTipo: 'evento', entidadId: randomUUID(), estado: entidades.EstadoEnvio.PENDIENTE, intentos: 0, payload: {} };
      const email = () => new EmailRepository(db.getRepository(entidades.EnvioNotificacion));
      const resultados = await Promise.allSettled(Array.from({ length: 10 }, () => email().reservarEnvio(datos)));
      assert.equal(resultados.filter((r) => r.status === 'fulfilled').length, 1);
      assert.equal(Number((await db.query('SELECT count(*) FROM envio_notificacion'))[0].count), 1);
      await db.destroy();
      db = await new DataSource(opciones).initialize();
      await assert.rejects(email().reservarEnvio(datos), /ENTREGA_INCIERTA/);
      const [envio] = await db.query('SELECT id FROM envio_notificacion');
      await email().actualizarEnvio(envio.id, { estado: entidades.EstadoEnvio.ENVIADO, ultimoError: null });
      assert.equal(await email().reservarEnvio(datos), null);
    });
  } finally {
    if (db.isInitialized) {
      await db.query(`DROP SCHEMA "${schema}" CASCADE`);
      await db.destroy();
    }
  }
});

test('C4: transporte RabbitMQ, reintentos, DLQ y reproceso real', { timeout: 125_000 }, async (t) => {
  const url = local('ACEPTACION_RABBITMQ_URL');
  const cola = `aceptacion.${randomUUID()}`;
  const routing = `aceptacion.${randomUUID()}`;
  const rabbit = new RabbitClient(new ConfigService({ RABBITMQ_URL: url }));
  const conexion = await amqp.connect(url);
  const canal = await conexion.createConfirmChannel();
  let falla = true;
  let intentos = 0;
  let efectos = 0;
  try {
    await declararCola(canal, { cola, bindings: [routing] });
    rabbit.onModuleInit();
    await rabbit.consumir({ cola, bindings: [routing] }, async () => {
      intentos++;
      if (falla) throw new Error('Fallo inducido de aceptación');
      efectos++;
    });
    await hasta(async () => (await canal.checkQueue(cola)).consumerCount > 0);
    await t.test('mensaje inválido termina en DLQ sin ejecutar handler', async () => {
      canal.publish(EXCHANGE, routing, Buffer.from('JSON inválido'), { persistent: true });
      await canal.waitForConfirms();
      const muerto = await hasta(() => canal.get(colaMuerta(cola), { noAck: false }));
      assert.equal(muerto.content.toString(), 'JSON inválido');
      assert.equal(intentos, 0);
      canal.ack(muerto);
    });
    const sobre = crearSobre('novedad.publicada', randomUUID(), { novedad_id: randomUUID(), titulo: 'Prueba DLQ' });
    await t.test('agotados tres reintentos llega a DLQ y puede reprocesarse conservando evento_id', async () => {
      canal.publish(EXCHANGE, routing, Buffer.from(JSON.stringify(sobre)), { persistent: true, messageId: sobre.evento_id });
      await canal.waitForConfirms();
      const muerto = await hasta(() => canal.get(colaMuerta(cola), { noAck: false }), 105_000);
      assert.equal(intentos, 4);
      assert.equal(muerto.properties.headers['x-intentos'], 3);
      assert.equal(JSON.parse(muerto.content.toString()).evento_id, sobre.evento_id);
      falla = false;
      canal.nack(muerto, false, true);
      const inspeccion = await new DlqService(new DlqClient()).ejecutar(url, colaMuerta(cola));
      assert.equal(inspeccion.length, 1);
      assert.equal(inspeccion[0].eventoId, sobre.evento_id);
      assert.equal((await canal.checkQueue(colaMuerta(cola))).messageCount, 1);
      const reproceso = await new DlqService(new DlqClient()).ejecutar(url, colaMuerta(cola), sobre.evento_id);
      assert.equal(reproceso.reprocesado, true);
      assert.equal(reproceso.eventoId, sobre.evento_id);
      await hasta(() => efectos === 1);
      assert.equal(intentos, 5);
    });
  } finally {
    await rabbit.onModuleDestroy();
    for (const nombre of [cola, `${cola}.reintento`, colaMuerta(cola)]) await canal.deleteQueue(nombre);
    await canal.close();
    await conexion.close();
  }
});

test('C2: despachadores concurrentes y recuperación tras caída del broker', { timeout: 190_000 }, async () => {
  const url = local('ACEPTACION_RABBITMQ_URL');
  const db = await new DataSource({ type: 'postgres', url: local('ACEPTACION_DATABASE_URL') }).initialize();
  const runner = db.createQueryRunner();
  await new Outbox1793361600000().up(runner);
  await runner.release();
  assert.equal(exigir('ACEPTACION_CONTROL_DOCKER'), 'SI');
  const cola = `aceptacion.${randomUUID()}`;
  const routing = `aceptacion.${randomUUID()}`;
  let conexion;
  let canal;
  let rabbit;
  let hijo;
  let detenido = false;
  try {
    const sinBroker = new PublicadorEventos(new RabbitClient(new ConfigService({}), new OutboxRepository(db)));
    await sinBroker.publicar('aviso.directo', null, { destinatario_id: randomUUID(), asunto: 'Sin broker', cuerpo: 'Prueba', origen: 'aceptacion' });
    const pendientesSinBroker = await db.query('SELECT id FROM evento_outbox WHERE publicado_at IS NULL');
    assert.equal(pendientesSinBroker.length, 1, 'La falta de URL del broker no debe perder el aviso');
    await db.query('DELETE FROM evento_outbox WHERE id=$1', [pendientesSinBroker[0].id]);
    const ids = Array.from({ length: 40 }, () => randomUUID());
    const repo = new OutboxRepository(db);
    for (const id of ids) await repo.guardar(id, routing, Buffer.from('{}'));
    const despachados = [];
    const enviar = async (_routing, _contenido, id) => { despachados.push(id); await esperar(5); };
    await Promise.all([repo.despachar(enviar), new OutboxRepository(db).despachar(enviar)]);
    assert.equal(despachados.length, 40);
    assert.equal(new Set(despachados).size, 40, 'SKIP LOCKED reparte el lote sin despacharlo dos veces');
    assert.equal(Number((await db.query('SELECT count(*) FROM evento_outbox WHERE publicado_at IS NOT NULL'))[0].count), 40);
    conexion = await amqp.connect(url);
    canal = await conexion.createChannel();
    await canal.assertExchange(EXCHANGE, 'topic', { durable: true });
    await canal.assertQueue(cola, { durable: true });
    await canal.bindQueue(cola, EXCHANGE, routing);
    await canal.close();
    await conexion.close();
    canal = null;
    conexion = null;
    await ejecutar('docker', [...compose, 'stop', 'rabbitmq'], { timeout: 30_000 });
    detenido = true;
    const eventoId = randomUUID();
    hijo = fork(require('node:path').join(__dirname, 'publicador.worker.cjs'), [], {
      execArgv: ['--require', require.resolve('ts-node/register/transpile-only')],
      env: { ...process.env, ACEPTACION_ROUTING: routing, ACEPTACION_EVENTO_ID: eventoId },
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'], windowsHide: true,
    });
    await new Promise((resolve, reject) => {
      const limite = setTimeout(() => reject(new Error('El publicador no arrancó')), 60_000);
      hijo.once('message', () => { clearTimeout(limite); resolve(); });
      hijo.once('error', (error) => { clearTimeout(limite); reject(error); });
      hijo.once('exit', () => { clearTimeout(limite); reject(new Error('El publicador terminó antes de encolar')); });
    });
    await new Promise((resolve) => { hijo.once('exit', resolve); hijo.kill('SIGKILL'); });
    hijo = null;
    assert.equal((await db.query('SELECT id FROM evento_outbox WHERE id=$1 AND publicado_at IS NULL', [eventoId])).length, 1);
    await ejecutar('docker', [...compose, 'start', 'rabbitmq'], { timeout: 45_000 });
    detenido = false;
    rabbit = new RabbitClient(new ConfigService({ RABBITMQ_URL: url }), new OutboxRepository(db));
    rabbit.onModuleInit();
    conexion = await hasta(async () => {
      try { return await amqp.connect(url); } catch { return null; }
    }, 120_000);
    canal = await conexion.createChannel();
    const recibido = await hasta(() => canal.get(cola, { noAck: true }));
    assert.equal(JSON.parse(recibido.content.toString()).evento_id, eventoId);
    await hasta(async () => (await db.query('SELECT id FROM evento_outbox WHERE id=$1 AND publicado_at IS NOT NULL', [eventoId])).length === 1);
  } finally {
    hijo?.kill('SIGKILL');
    if (detenido) await ejecutar('docker', [...compose, 'start', 'rabbitmq'], { timeout: 45_000 });
    await rabbit?.onModuleDestroy();
    if (canal) { await canal.deleteQueue(cola); await canal.close(); }
    await conexion?.close();
    await db.query('DROP TABLE evento_outbox');
    await db.destroy();
  }
});
