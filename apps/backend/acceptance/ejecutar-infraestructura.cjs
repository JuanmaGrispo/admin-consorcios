const { randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');
const path = require('node:path');

const cwd = path.resolve(__dirname, '..');
const compose = ['compose', '-f', path.join(__dirname, 'compose.yml')];
const env = { ...process.env,
  ACEPTACION_DB_USUARIO: 'aceptacion', ACEPTACION_DB_PASSWORD: randomBytes(24).toString('hex'),
  ACEPTACION_MQ_USUARIO: 'aceptacion', ACEPTACION_MQ_PASSWORD: randomBytes(24).toString('hex'),
  ACEPTACION_CONTROL_DOCKER: 'SI',
  ACEPTACION_ERLANG_COOKIE: randomBytes(24).toString('hex'),
};
env.ACEPTACION_DATABASE_URL = `postgresql://${env.ACEPTACION_DB_USUARIO}:${env.ACEPTACION_DB_PASSWORD}@127.0.0.1:55432/domus_aceptacion`;
env.ACEPTACION_RABBITMQ_URL = `amqp://${env.ACEPTACION_MQ_USUARIO}:${env.ACEPTACION_MQ_PASSWORD}@127.0.0.1:55672`;

function ejecutar(comando, args) {
  return new Promise((resolve, reject) => {
    const hijo = spawn(comando, args, { cwd, env, stdio: 'inherit', windowsHide: true });
    hijo.once('error', reject);
    hijo.once('exit', (codigo) => codigo === 0 ? resolve() : reject(new Error(`${comando} terminó con código ${codigo}`)));
  });
}

(async () => {
  // Proyecto dedicado, puertos locales, sin .env y sin volúmenes persistentes.
  // No se ejecuta down sobre el compose de la aplicación.
  await ejecutar('docker', ['info', '--format', '{{.ServerVersion}}']);
  try {
    await ejecutar('docker', [...compose, 'up', '-d', '--wait']);
    // El nodo Erlang puede responder ping antes de abrir el listener AMQP.
    const amqp = require('amqplib');
    let disponible = false;
    for (let intento = 0; intento < 120; intento++) {
      try {
        const conexion = await amqp.connect(env.ACEPTACION_RABBITMQ_URL);
        await conexion.close();
        disponible = true;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    if (!disponible) throw new Error('RabbitMQ no abrió AMQP en 120 segundos');
    await ejecutar(process.execPath, ['--require', 'ts-node/register/transpile-only', '--test', '--test-concurrency=1', ...process.argv.slice(2), 'acceptance/infraestructura.test.cjs']);
  } catch (error) {
    await ejecutar('docker', [...compose, 'logs', '--tail', '60']).catch(() => undefined);
    throw error;
  } finally {
    await ejecutar('docker', [...compose, 'down', '--volumes']);
  }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
