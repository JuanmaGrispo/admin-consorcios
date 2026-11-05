const { randomBytes, createHash } = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const amqp = require('amqplib');
const { setTimeout: esperar } = require('node:timers/promises');
const fixtures = require('./fixtures.cjs');
const smtp = require('./servidor-smtp.cjs');
const proveedor = require('./servidor-proveedor.cjs');
const os = require('node:os');
const assert = require('node:assert/strict');
const cwd = path.resolve(__dirname, '..');
const compose = ['compose', '-f', path.join(__dirname, 'compose.yml')];
const aleatorio = () => randomBytes(24).toString('hex');
const env = { ...process.env, ACEPTACION_DB_USUARIO: 'aceptacion', ACEPTACION_DB_PASSWORD: aleatorio(),
  ACEPTACION_MQ_USUARIO: 'aceptacion', ACEPTACION_MQ_PASSWORD: aleatorio(), ACEPTACION_ERLANG_COOKIE: aleatorio(),
  NODE_ENV: 'test', PORT: '4400', DB_SSL: 'false', DB_POOL_MAX: process.env.DB_POOL_MAX || '10', JWT_SECRET: aleatorio(), API_GLOBAL_PREFIX: '/api',
  CORS_ORIGINS: 'http://127.0.0.1:3300', MP_NOTIFICATION_URL: '', FRONTEND_URL: 'http://127.0.0.1:3300',
  MP_ACCESS_TOKEN: '', MP_WEBHOOK_SECRET: '', SUPABASE_URL: 'http://127.0.0.1:1', SUPABASE_SERVICE_ROLE_KEY: '',
  SEED_PASSWORD: aleatorio(), ACEPTACION_ESCRITURA: 'SI',
};
env.DATABASE_URL = `postgresql://${env.ACEPTACION_DB_USUARIO}:${env.ACEPTACION_DB_PASSWORD}@127.0.0.1:55432/domus_aceptacion`;
env.ACEPTACION_DATABASE_URL = env.DATABASE_URL;
env.RABBITMQ_URL = `amqp://${env.ACEPTACION_MQ_USUARIO}:${env.ACEPTACION_MQ_PASSWORD}@127.0.0.1:55672`;
env.ACEPTACION_BASE_URL = 'http://127.0.0.1:4400/api';
env.MP_WEBHOOK_SECRET = aleatorio(); env.ACEPTACION_MP_SECRET = env.MP_WEBHOOK_SECRET;

function ejecutar(comando, args, opciones = {}) {
  return new Promise((resolve, reject) => {
    const hijo = spawn(comando, args, { cwd, env, stdio: 'inherit', windowsHide: true, ...opciones });
    hijo.once('error', reject);
    hijo.once('exit', (codigo) => codigo === 0 ? resolve() : reject(new Error(`${path.basename(comando)} terminó con código ${codigo}`)));
  });
}
async function hasta(accion, limite = 120_000) {
  const inicio = Date.now();
  while (Date.now() - inicio < limite) { try { const v = await accion(); if (v) return v; } catch {} await esperar(500); }
  throw new Error('No se alcanzó disponibilidad del entorno de aceptación');
}
let backend, frontend, correo, externo, db;
const contenedorBackend = 'domus-aceptacion-backend';
const imagenBackend = 'domus-aceptacion-backend:local';
const enDocker = !process.argv.includes('--host');
const soloCarga = process.argv.includes('--solo-carga');
const soloZap = process.argv.includes('--solo-zap');
if (soloZap) env.NODE_ENV = 'production';
const carpetaZap = process.argv.includes('--csp') ? 'zap-csp' : 'zap';
const informeRunnerPath = path.join(__dirname, soloZap ? `resultados/${carpetaZap}-entorno.json` : 'resultados/integral.json');
let imagenLista = false;
async function iniciarBackend() {
  if (enDocker) {
    if (!imagenLista) {
      await ejecutar('docker', ['build', '-f', path.join(cwd, 'Dockerfile'), '-t', imagenBackend, path.resolve(cwd, '../..')]);
      imagenLista = true;
    }
    const destino = new URL(externo.url); destino.hostname = 'host.docker.internal';
    const runtime = { ...env, DATABASE_URL: env.DATABASE_URL.replace('127.0.0.1:55432', 'postgres:5432'),
      RABBITMQ_URL: env.RABBITMQ_URL.replace('127.0.0.1:55672','rabbitmq:5672'),
      SMTP_HOST: 'host.docker.internal', MP_API_URL: destino.toString().replace(/\/$/, ''), SUPABASE_URL: destino.toString().replace(/\/$/, '') };
    const claves = ['DATABASE_URL','RABBITMQ_URL','DB_SSL','DB_POOL_MAX','JWT_SECRET','PORT','NODE_ENV','API_GLOBAL_PREFIX','SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS','MAIL_FROM',
      'MP_API_URL','MP_ACCESS_TOKEN','MP_WEBHOOK_SECRET','SUPABASE_URL','SUPABASE_PUBLIC_URL','SUPABASE_SERVICE_ROLE_KEY','CORS_ORIGINS','MP_NOTIFICATION_URL','FRONTEND_URL'];
    await ejecutar('docker', ['run','-d','--name',contenedorBackend,'--network','domus-aceptacion_default', '--add-host','host.docker.internal:host-gateway',
      '-p','127.0.0.1:4400:4400', ...claves.flatMap((k) => ['--env', k]), imagenBackend], { env: runtime });
    await hasta(async () => (await fetch(env.ACEPTACION_BASE_URL + '/health', { signal: AbortSignal.timeout(1000) })).ok, 60_000);
    return;
  }
  const log = fs.openSync(path.join(__dirname, 'resultados/backend.log'), 'a');
  backend = spawn(process.execPath, ['--require', 'ts-node/register/transpile-only', 'src/main.ts'], { cwd, env, stdio: ['ignore', log, log], windowsHide: true });
  fs.closeSync(log);
  await hasta(async () => (await fetch(env.ACEPTACION_BASE_URL + '/health', { signal: AbortSignal.timeout(1000) })).ok, 60_000);
}
async function detenerBackend() {
  if (enDocker) {
    const existe = spawnSync('docker', ['inspect', '--format','{{.State.Running}}',contenedorBackend], { encoding:'utf8', windowsHide:true });
    if (existe.status === 0) {
      if (existe.stdout.trim() === 'true') await ejecutar('docker', ['kill', contenedorBackend]);
      const log = fs.openSync(path.join(__dirname, 'resultados/backend.log'), 'a');
      try { await ejecutar('docker', ['logs', contenedorBackend], { stdio: ['ignore', log, log] }); }
      finally { fs.closeSync(log); }
      await ejecutar('docker', ['rm', '-f', contenedorBackend]);
    }
    return;
  }
  if (backend && backend.exitCode === null) { const salida = once(backend, 'exit'); backend.kill('SIGKILL'); await salida; }
  backend = null;
}
async function probarWeb() {
  const carpeta = path.resolve(cwd, '../frontend');
  const log = fs.openSync(path.join(__dirname, 'resultados/frontend.log'), 'a');
  frontend = spawn(process.execPath, [path.join(carpeta,'node_modules/next/dist/bin/next'), 'dev', '--webpack', '--port','3300','--hostname','127.0.0.1'],
    { cwd: carpeta, env: { ...env, NODE_ENV: 'development', NEXT_PUBLIC_API_URL: env.ACEPTACION_BASE_URL }, stdio: ['ignore',log,log], windowsHide:true, detached:process.platform!=='win32' });
  fs.closeSync(log);
  try {
    await hasta(async () => (await fetch('http://127.0.0.1:3300/login', { signal: AbortSignal.timeout(2000) })).ok, 120_000);
    await ejecutar(process.execPath, [path.join(carpeta,'node_modules/@playwright/test/cli.js'), 'test','--config','playwright.aceptacion.config.ts'], { cwd:carpeta });
  } finally {
    if (frontend.exitCode === null) {
      if (process.platform === 'win32') spawnSync('taskkill',['/PID',String(frontend.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
      else process.kill(-frontend.pid,'SIGTERM');
    }
    frontend = null;
  }
}
async function login(email) {
  const r = await fetch(env.ACEPTACION_BASE_URL + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: env.SEED_PASSWORD }) });
  if (!r.ok) throw new Error('No se pudo iniciar una sesión de prueba');
  return (await r.json()).accessToken;
}

async function probarRecuperacion(datos) {
  const titulo = 'Recuperacion-' + aleatorio().slice(0, 24);
  await ejecutar('docker', [...compose, 'stop', 'rabbitmq']);
  const r = await fetch(env.ACEPTACION_BASE_URL + '/novedades', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.ACEPTACION_TOKEN}` },
    body: JSON.stringify({ consorcioId: datos.consorcioId, titulo, cuerpo: 'Comunicado de prueba durante caída del broker' }) });
  assert.equal(r.status, 201);
  const novedad = await r.json();
  const { rows: [pendiente] } = await db.query(`SELECT id,contenido FROM evento_outbox WHERE routing='novedad.publicada'
    AND convert_from(contenido,'UTF8')::jsonb #>> '{payload,novedad_id}'=$1 AND publicado_at IS NULL`, [novedad.id]);
  assert.ok(pendiente, 'Negocio y outbox deben quedar confirmados juntos');
  await detenerBackend();
  await iniciarBackend(); // Debe arrancar aunque el broker continúe apagado.
  await ejecutar('docker', [...compose, 'start', 'rabbitmq']);
  await hasta(async () => { const c = await amqp.connect(env.RABBITMQ_URL); await c.close(); return true; });
  await hasta(async () => (await db.query('SELECT id FROM evento_outbox WHERE id=$1 AND publicado_at IS NOT NULL', [pendiente.id])).rowCount === 1);
  await hasta(async () => Number((await db.query("SELECT count(*) FROM envio_notificacion WHERE entidad_id=$1 AND estado='ENVIADO'", [pendiente.id])).rows[0].count) === 50);
  const notificaciones = (await db.query('SELECT id FROM notificacion WHERE entidad_id=$1', [novedad.id])).rowCount;
  assert.equal(notificaciones, 50);
  const correos = correo.mensajes.filter((m) => m.includes(titulo)).length;
  assert.equal(correos, 50);
  const estadisticas = async () => {
    const r = await fetch('http://127.0.0.1:55673/api/queues/%2F/q.email-notificador', {
      headers: { Authorization: 'Basic ' + Buffer.from(`${env.ACEPTACION_MQ_USUARIO}:${env.ACEPTACION_MQ_PASSWORD}`).toString('base64') },
    });
    if (!r.ok) throw new Error('Management aún no disponible');
    return r.json();
  };
  const antes = await hasta(async () => { const q = await estadisticas(); return q.message_stats?.ack >= 1 && q.messages === 0 ? q : null; });
  const conexion = await amqp.connect(env.RABBITMQ_URL), canal = await conexion.createConfirmChannel();
  try {
    for (let i = 0; i < 2; i++) canal.publish('domus.eventos', 'novedad.publicada', pendiente.contenido, { persistent: true, messageId: pendiente.id });
    await canal.waitForConfirms();
    await hasta(async () => { const q = await estadisticas(); return q.message_stats?.ack >= antes.message_stats.ack + 2 && q.messages === 0; });
    assert.equal(correo.mensajes.filter((m) => m.includes(titulo)).length, correos);
    assert.equal((await db.query('SELECT id FROM notificacion WHERE entidad_id=$1', [novedad.id])).rowCount, 50);
  } finally { await canal.close(); await conexion.close(); }
  console.log('C2/C3: operación HTTP recuperada después de caída y reinicio; duplicados sin nuevos correos ni notificaciones.');
}

async function probarCompensacionArchivo() {
  const form = new FormData();
  form.append('archivo', new Blob([Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0,0,0,0,0])], { type: 'image/png' }), 'prueba.png');
  const r = await fetch(env.ACEPTACION_BASE_URL + '/archivos?destino=reclamos', { method: 'POST', headers: { Authorization: `Bearer ${env.ACEPTACION_TOKEN}` }, body: form });
  assert.equal(r.status, 201);
  env.ACEPTACION_ARCHIVO_URL = (await r.json()).url;
  const fallido = await fetch(env.ACEPTACION_BASE_URL + '/reclamos', { method:'POST', headers: { Authorization:`Bearer ${env.ACEPTACION_TOKEN}`, 'Content-Type':'application/json' },
    body:JSON.stringify({ ...JSON.parse(env.ACEPTACION_RECLAMO_JSON), descripcion:'corta', adjuntos:[{url:env.ACEPTACION_ARCHIVO_URL}] }) });
  assert.equal(fallido.status,400);
  env.ACEPTACION_ARCHIVO_FASE = 'activo';
  await ejecutar(process.execPath,['--require','ts-node/register/transpile-only','--test','acceptance/archivos-compensacion.test.cjs']);
  await detenerBackend();
  await hasta(async () => Number((await db.query("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND application_name='domus-backend'")).rows[0].count) === 0);
  env.ACEPTACION_ARCHIVO_FASE = 'mantenimiento';
  await ejecutar(process.execPath,['--require','ts-node/register/transpile-only','--test','acceptance/archivos-compensacion.test.cjs']);
  await iniciarBackend();
  console.log('C5: archivo huérfano compensado dos veces sin efectos adicionales, solo en mantenimiento.');
}

(async () => {
  fs.mkdirSync(path.join(__dirname, 'resultados'), { recursive: true });
  // Evita atribuir una medición anterior a una corrida que falla antes de k6.
  if (process.argv.includes('--carga')) fs.rmSync(path.join(__dirname, 'resultados/carga-resumen.json'), { force: true });
  fs.writeFileSync(informeRunnerPath, JSON.stringify({ resultado: 'en ejecución', fecha: new Date().toISOString() }));
  if (soloCarga && (!process.argv.includes('--carga') || process.argv.includes('--web'))) throw new Error('Usar --solo-carga --carga, sin --web');
  if (soloZap && (soloCarga || process.argv.includes('--carga') || process.argv.includes('--web') || !enDocker)) throw new Error('Usar --solo-zap sin --carga, --web, --solo-carga ni --host');
  try {
    await ejecutar('docker', [...compose, 'up', '-d', '--wait']);
    await hasta(async () => { const c = await amqp.connect(env.RABBITMQ_URL); await c.close(); return true; });
    db = new Client({ connectionString: env.DATABASE_URL }); await db.connect();
    // URL y nombre los construye este runner; no se lee .env ni un destino remoto.
    if (new URL(env.DATABASE_URL).hostname !== '127.0.0.1' || !env.DATABASE_URL.endsWith('/domus_aceptacion')) throw new Error('Destino de prueba inválido');
    await db.query('DROP SCHEMA public CASCADE');
    await db.query('CREATE SCHEMA public; CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public');
    await db.query(fs.readFileSync(path.join(__dirname, 'esquema.sql'), 'utf8').replace('CREATE SCHEMA public;', ''));
    await db.query('SET search_path=public');
    for (const m of require('./esquema-migraciones.json')) await db.query('INSERT INTO migrations(timestamp,name) VALUES($1,$2)', [m.timestamp, m.name]);
    await ejecutar(process.execPath, ['--require', 'ts-node/register/transpile-only', 'node_modules/typeorm/cli.js', 'migration:run', '-d', 'src/database/data-source.ts']);
    const datos = await fixtures(db, env.SEED_PASSWORD);
    Object.assign(env, { ACEPTACION_ADMIN_ID: datos.adminId, ACEPTACION_SUPER_ID: datos.superId });
    correo = await smtp();
    externo = await proveedor();
    Object.assign(env, { MP_API_URL: externo.url, MP_ACCESS_TOKEN: 'simulado', ACEPTACION_PROVEEDOR_URL: externo.url,
      SUPABASE_URL: externo.url, SUPABASE_PUBLIC_URL: externo.url, SUPABASE_SERVICE_ROLE_KEY: 'simulado' });
    Object.assign(env, { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(correo.puerto), SMTP_USER: 'aceptacion', SMTP_PASS: aleatorio(), MAIL_FROM: 'Domus <prueba@example.test>',
      ACEPTACION_CONSORCIO_ID: datos.consorcioId, ACEPTACION_RECLAMO_JSON: JSON.stringify({ unidadId: datos.unidadId, categoriaId: datos.categoriaId, titulo: 'Aceptación', descripcion: 'Reclamo de prueba de aceptación' }), ACEPTACION_REPETIR_CLAVE: aleatorio() });
    env.ACEPTACION_BOLETA_ID = datos.boletaId;
    await iniciarBackend();
    env.ACEPTACION_TOKEN = await login('super@example.test');
    env.ACEPTACION_ADMIN_TOKEN = await login('admin@example.test');
    env.ACEPTACION_VECINO_TOKEN = await login(datos.usuarios[0].email);
    env.ACEPTACION_AJENO_TOKEN = await login('ajeno@example.test');
    if (soloZap) {
      await require('./zap.cjs')({ env, datos, db, ejecutar, hasta, contenedorBackend });
      fs.writeFileSync(informeRunnerPath, JSON.stringify({ resultado: 'ejecutado', alcance: `ZAP, ver ${carpetaZap}/resumen.json`, fecha: new Date().toISOString() }));
      return;
    }
    if (!soloCarga) {
    await ejecutar(process.execPath, ['--test', 'acceptance/http.test.cjs']);
    await ejecutar(process.execPath, ['--test', 'acceptance/negocio.test.cjs']);
    env.ACEPTACION_SMTP_EVENTO = require('node:crypto').randomUUID();
    env.ACEPTACION_SMTP_ASUNTO = 'SMTP-' + env.ACEPTACION_SMTP_EVENTO;
    env.ACEPTACION_SMTP_FASE = 'enviar';
    await ejecutar(process.execPath, ['--require', 'ts-node/register/transpile-only', '--test', 'acceptance/consumidores.test.cjs']);
    env.ACEPTACION_SMTP_FASE = 'reintentar';
    await ejecutar(process.execPath, ['--require', 'ts-node/register/transpile-only', '--test', 'acceptance/consumidores.test.cjs']);
    assert.equal(correo.mensajes.filter((m) => m.includes(env.ACEPTACION_SMTP_ASUNTO)).length, 1);
    await detenerBackend(); await iniciarBackend();
    // Repite la misma clave y contenido sobre la misma base después del reinicio.
    await ejecutar(process.execPath, ['--test', 'acceptance/http.test.cjs']);
    await probarRecuperacion(datos);
    await probarCompensacionArchivo();
    if (process.argv.includes('--web')) await probarWeb();
    } else {
      await ejecutar(process.execPath, ['--test', '--test-name-pattern', 'boletas:|numeración|sesión:|espera acotada', 'acceptance/http.test.cjs']);
    }
    if (process.argv.includes('--carga')) {
      const identidades = [];
      for (const persona of datos.usuarios) identidades.push({ token: await login(persona.email), boletaId: persona.boletaId,
        reclamo: { unidadId: persona.unidadId, categoriaId: datos.categoriaId, descripcion: 'Reclamo de prueba de carga representativa' } });
      const destino = path.join(__dirname, 'resultados/carga-identidades.json');
      fs.writeFileSync(destino, JSON.stringify(identidades));
      env.CARGA_BASE_URL = enDocker ? 'http://domus-aceptacion-backend:4400/api' : 'http://host.docker.internal:4400/api';
      env.CARGA_FIXTURES = '/fixtures.json';
      try {
        await ejecutar('docker', ['run', '--rm', ...(enDocker ? ['--network', 'domus-aceptacion_default'] : ['--add-host','host.docker.internal:host-gateway']), '-u', '0',
          '-v', `${path.join(__dirname, 'carga.js')}:/carga.js:ro`, '-v', `${destino}:/fixtures.json:ro`,
          '-v', `${path.join(__dirname, 'resultados')}:/resultados`, '--env', 'CARGA_BASE_URL', '--env', 'CARGA_FIXTURES', '--env', 'ACEPTACION_ESCRITURA',
          'grafana/k6:1.0.0', 'run', '--summary-export', '/resultados/carga-resumen.json', '/carga.js']);
      } finally { fs.unlinkSync(destino); }
    }
    const git = (args) => spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true }).stdout?.trim();
    const informe = { fecha: new Date().toISOString(), resultado: 'aprobado', reinicioBackend: !soloCarga,
      alcance: soloCarga ? 'carga y regresión puntual de boletas/numeración/sesión/idempotencia' : 'integral',
      commit: git(['rev-parse','HEAD']), cambiosSinCommit: Boolean(git(['status','--porcelain'])),
      entorno: { nodeRunner: process.version, backend: enDocker ? 'Node 22, imagen Docker del repo' : process.version, plataforma: os.platform(), cpusHost: os.cpus().length, memoriaHostBytes: os.totalmem(), postgres: (await db.query('SHOW server_version')).rows[0].server_version },
      esquemaSha256: createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'esquema.sql'))).digest('hex'),
      esquema: (await db.query('SELECT name FROM migrations ORDER BY timestamp')).rows.map((m) => m.name),
      cargaEjecutada: process.argv.includes('--carga'), webEjecutada: !soloCarga && process.argv.includes('--web'),
      calentamiento: process.argv.includes('--carga') ? { lecturas: 100, altasReclamo: 50, fueraDeVentana: true } : null,
      dataset: { unidades: 500, boletas: 3000, lineasBoleta: 9000, reclamosIniciales: 500, identidades: 50 } };
    fs.writeFileSync(informeRunnerPath, JSON.stringify(informe, null, 2));
    console.log(soloCarga ? 'Carga y regresión puntual aprobadas.' : 'API integral y repetición tras reinicio aprobadas.');
  } finally {
    await detenerBackend().catch(() => undefined);
    await correo?.cerrar(); await db?.end();
    await externo?.cerrar();
    await ejecutar('docker', [...compose, 'down', '--volumes']);
  }
})().catch((e) => {
  fs.writeFileSync(informeRunnerPath, JSON.stringify({ fecha: new Date().toISOString(), resultado: 'fallido', error: e.message }, null, 2));
  console.error(e.message); process.exitCode = 1;
});
