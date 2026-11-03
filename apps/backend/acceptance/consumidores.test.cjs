require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const { ConfigService } = require('@nestjs/config');
const entidades = require('../src/database/entities');
const { NovedadesRepository } = require('../src/modules/novedades/novedades.repository');
const { EmailRepository } = require('../src/modules/email/email.repository');
const { EmailService } = require('../src/modules/email/email.service');
const { MailerClient } = require('../src/modules/email/mailer.client');
const { crearSobre } = require('../src/core/mensajeria/eventos');
const opciones = { type: 'postgres', url: process.env.ACEPTACION_DATABASE_URL,
  entities: Object.values(entidades).filter((e) => typeof e === 'function'), synchronize: false };

test('C3 muro: diez duplicados concurrentes, reconexión y rollback de efecto + marca', async () => {
  assert.equal(new URL(opciones.url).hostname, '127.0.0.1');
  let db = await new DataSource(opciones).initialize();
  const id = randomUUID();
  const datos = { consorcioId: process.env.ACEPTACION_CONSORCIO_ID, autorId: process.env.ACEPTACION_ADMIN_ID,
    titulo: 'Muro-' + id, cuerpo: 'Novedad de aceptación', publicadaAt: new Date() };
  const repo = () => new NovedadesRepository(db.getRepository(entidades.Novedad), db.getRepository(entidades.NovedadLectura));
  try {
    const resultados = await Promise.all(Array.from({ length: 10 }, () => repo().crearDesdeEvento(id, 'muro-novedades', datos)));
    assert.equal(resultados.filter(Boolean).length, 1);
    await db.destroy(); db = await new DataSource(opciones).initialize();
    assert.equal(await repo().crearDesdeEvento(id, 'muro-novedades', datos), false);
    assert.equal(Number((await db.query('SELECT count(*) FROM novedad WHERE titulo=$1', [datos.titulo]))[0].count), 1);
    const fallido = randomUUID();
    await assert.rejects(repo().crearDesdeEvento(fallido, 'muro-novedades', { ...datos, autorId: randomUUID() }));
    assert.equal(Number((await db.query('SELECT count(*) FROM evento_procesado WHERE evento_id=$1', [fallido]))[0].count), 0);
  } finally { await db.destroy(); }
});

test('C3 SMTP: aceptación externa y fallo de confirmación persiste incertidumbre tras otro proceso', async () => {
  assert.equal(new URL(opciones.url).hostname, '127.0.0.1');
  assert.match(process.env.ACEPTACION_SMTP_EVENTO, /^[0-9a-f-]{36}$/);
  const db = await new DataSource(opciones).initialize();
  const config = new ConfigService(process.env);
  const mailer = new MailerClient(config);
  const evento = crearSobre('aviso.directo', null, { destinatario_id: process.env.ACEPTACION_SUPER_ID,
    asunto: process.env.ACEPTACION_SMTP_ASUNTO, cuerpo: 'Correo de prueba de resultado incierto', origen: 'reclamo' });
  evento.evento_id = process.env.ACEPTACION_SMTP_EVENTO;
  const service = new EmailService(new EmailRepository(db.getRepository(entidades.EnvioNotificacion)), mailer);
  try {
    if (process.env.ACEPTACION_SMTP_FASE === 'enviar') {
      await db.query(`CREATE FUNCTION fallar_confirmacion_smtp() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF NEW.entidad_id='${evento.evento_id}'::uuid AND NEW.estado='ENVIADO' THEN
        RAISE EXCEPTION 'fallo inducido al confirmar SMTP'; END IF; RETURN NEW; END $$`);
      await db.query('CREATE TRIGGER fallo_confirmacion_smtp BEFORE UPDATE ON envio_notificacion FOR EACH ROW EXECUTE FUNCTION fallar_confirmacion_smtp()');
      try { await assert.rejects(service.procesar(evento)); }
      finally { await db.query('DROP TRIGGER fallo_confirmacion_smtp ON envio_notificacion; DROP FUNCTION fallar_confirmacion_smtp()'); }
    } else await assert.rejects(service.procesar(evento), /incierta/);
    const [fila] = await db.query('SELECT ultimo_error,estado FROM envio_notificacion WHERE entidad_id=$1', [evento.evento_id]);
    assert.match(fila.ultimo_error, /ENTREGA_INCIERTA/); assert.notEqual(fila.estado, 'ENVIADO');
  } finally { mailer.onModuleDestroy(); await db.destroy(); }
});
