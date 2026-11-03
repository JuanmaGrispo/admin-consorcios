// Solo esquema: nunca exportar datos ni imprimir DATABASE_URL.
require('dotenv/config');
const { Client } = require('pg');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const url = new URL(process.env.DATABASE_URL);
  const client = new Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10_000 });
  let version;
  let migraciones;
  try {
    await client.connect();
    version = (await client.query('SHOW server_version_num')).rows[0].server_version_num;
    migraciones = (await client.query('SELECT timestamp::text, name FROM migrations ORDER BY id')).rows;
  } finally { await client.end(); }
  const major = Math.floor(Number(version) / 10000);
  const env = { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: url.pathname.slice(1), PGSSLMODE: 'require' };
  const args = ['run', '--rm', ...['PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE','PGSSLMODE'].flatMap((key) => ['--env', key]), `postgres:${major}-alpine`, 'pg_dump', '--schema-only', '--schema=public', '--no-owner', '--no-acl', '--no-comments'];
  const result = spawnSync('docker', args, { env, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, timeout: 240_000, windowsHide: true });
  if (result.status !== 0) throw new Error('No se pudo exportar el esquema: ' + (result.error?.message || result.stderr));
  // PG17+ agrega claves aleatorias para \restrict: quitarlas evita ruido en git.
  const schema = result.stdout.replace(/^\\(?:un)?restrict .*\r?\n/gm, '');
  const destino = path.join(__dirname, 'esquema.sql');
  fs.writeFileSync(destino, '-- Esquema public sin datos, exportado desde la base fuente. Regenerar con acceptance/exportar-esquema.cjs.\n' + schema);
  fs.writeFileSync(path.join(__dirname, 'esquema-migraciones.json'), JSON.stringify(migraciones, null, 2) + '\n');
  console.log(`Esquema sin datos exportado (PostgreSQL ${major}). Revisar el diff antes de commitear.`);
})().catch((e) => { console.error(e.message); process.exitCode = 1; });
