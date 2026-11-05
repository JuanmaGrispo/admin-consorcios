/**
 * Prepara la base local de `docker compose up` (no toca Supabase).
 *
 *   1. Genera, una sola vez, los secretos del entorno local (JWT, contraseña
 *      de las cuentas de demo, firma del webhook) en /config/secretos.env.
 *      Viven en un volumen de Docker: nunca entran al repositorio.
 *   2. Si la base está vacía, carga el esquema exportado, corre las
 *      migraciones y el seed de demo, y crea el superadministrador.
 *   3. Si ya estaba cargada, sólo aplica las migraciones nuevas.
 *
 * Corre como servicio `inicializador` del compose; el backend espera a que
 * termine bien antes de arrancar.
 */
const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const raiz = path.resolve(__dirname, '..');
const archivoSecretos = process.env.ARCHIVO_SECRETOS || '/config/secretos.env';

function secretos() {
  if (fs.existsSync(archivoSecretos)) {
    return Object.fromEntries(
      fs.readFileSync(archivoSecretos, 'utf8').split('\n').filter((l) => l.includes('='))
        .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }),
    );
  }
  const nuevos = {
    JWT_SECRET: randomBytes(48).toString('base64url'),
    // Legible para tipearla en el login de la demo.
    SEED_PASSWORD: 'Demo-' + randomBytes(6).toString('hex'),
    MP_WEBHOOK_SECRET: randomBytes(32).toString('hex'),
  };
  fs.mkdirSync(path.dirname(archivoSecretos), { recursive: true });
  fs.writeFileSync(archivoSecretos, Object.entries(nuevos).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o644 });
  return nuevos;
}

function correr(descripcion, args, env) {
  console.log(`→ ${descripcion}`);
  const r = spawnSync(process.execPath, ['--require', 'ts-node/register/transpile-only', ...args], { cwd: raiz, env, stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`Falló: ${descripcion}`);
}

async function conectar() {
  for (let i = 0; i < 60; i++) {
    const db = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432), user: process.env.DB_USER,
      password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
    try { await db.connect(); return db; } catch { await db.end().catch(() => {}); await new Promise((r) => setTimeout(r, 1000)); }
  }
  throw new Error('PostgreSQL no respondió en 60 s');
}

async function main() {
  const s = secretos();
  const env = { ...process.env, ...s, DB_SSL: 'false' };
  const db = await conectar();
  const { rows: [{ existe }] } = await db.query("SELECT to_regclass('public.usuario') IS NOT NULL AS existe");

  if (!existe) {
    console.log('→ Base vacía: cargando el esquema');
    await db.query('CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public');
    const esquema = fs.readFileSync(path.join(raiz, 'acceptance/esquema.sql'), 'utf8').replace('CREATE SCHEMA public;', '');
    await db.query(esquema);
    await db.query('SET search_path=public');
    for (const m of require('../acceptance/esquema-migraciones.json')) {
      await db.query('INSERT INTO migrations(timestamp,name) VALUES($1,$2)', [m.timestamp, m.name]);
    }
  }
  await db.end();

  correr('Migraciones', ['node_modules/typeorm/cli.js', 'migration:run', '-d', 'src/database/data-source.ts'], env);

  if (!existe) {
    correr('Datos de demo', ['src/scripts/seed-demo.ts', '--aplicar'], env);
    correr('Superadministrador', ['src/scripts/crear-usuario.ts', 'super@domus.test', s.SEED_PASSWORD, 'SUPER_ADMIN', 'Super', 'Administrador'], env);
  }

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(' Domus listo. Cuentas de demo (misma contraseña para todas):');
  console.log('   super@domus.test   superadministrador');
  console.log('   admin@domus.test   administrador');
  console.log('   vecino@domus.test  vecino');
  console.log(`   Contraseña: ${s.SEED_PASSWORD}`);
  console.log(' Frontend http://localhost:3000 · Mails http://localhost:4010/correos');
  console.log('══════════════════════════════════════════════════════════════\n');
}

main().catch((e) => { console.error(`✖ ${e.message}`); process.exit(1); });
