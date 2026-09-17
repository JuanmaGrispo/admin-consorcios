import dataSource from './data-source';

/**
 * Chequeo de conexión: `pnpm back db:check`. Abre la conexión con las mismas
 * variables que usa la app, dice contra qué base pegó y corta. Sirve para
 * separar "la config está mal" de "el código está mal".
 */
async function main() {
  try {
    await dataSource.initialize();
  } catch (error) {
    console.error('✖ No se pudo conectar.');
    console.error(`  ${(error as Error).message}`);
    process.exit(1);
  }

  const [info] = await dataSource.query<
    { db: string; usuario: string; version: string }[]
  >('SELECT current_database() AS db, current_user AS usuario, version() AS version');

  const tablas = await dataSource.query<{ tablename: string }[]>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
  );

  console.log('✔ Conectado.');
  console.log(`  base:    ${info.db}`);
  console.log(`  usuario: ${info.usuario}`);
  console.log(`  server:  ${info.version.split(' ').slice(0, 2).join(' ')}`);
  console.log(
    `  tablas:  ${tablas.length ? tablas.map((t) => t.tablename).join(', ') : '(ninguna todavía)'}`,
  );

  await dataSource.destroy();
}

void main();
