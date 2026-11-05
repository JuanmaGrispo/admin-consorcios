import type { DataSourceOptions } from 'typeorm';

type EnvReader = (key: string) => string | undefined;

/** La parte de "a qué base me conecto" — sin entidades ni migraciones. */
type ConnectionOptions = Pick<
  Extract<DataSourceOptions, { type: 'postgres' }>,
  'type' | 'url' | 'host' | 'port' | 'username' | 'password' | 'database' | 'ssl' | 'extra'
>;

/**
 * Opciones de conexión compartidas por la app (DatabaseModule) y por la CLI de
 * TypeORM (data-source.ts), para que las dos apunten siempre a la misma base.
 *
 * Con `DATABASE_URL` se conecta por connection string: es lo que entrega
 * Supabase y lo que esperan casi todos los hostings. Sin ella, cae a los `DB_*`
 * sueltos del Postgres local.
 *
 * SSL: Supabase lo exige. Si no se define `DB_SSL`, se asume que una conexión
 * por connection string es remota (SSL on) y una por `DB_*` es local (SSL off).
 *
 * Pool: sin `DB_POOL_MAX` queda el default del driver (10 conexiones), lo
 * prudente contra el pooler gratuito de Supabase y lo que mejor midió en la
 * prueba de carga.
 */
export function buildConnectionOptions(env: EnvReader): ConnectionOptions {
  const url = env('DATABASE_URL');
  const sslFlag = env('DB_SSL');
  // El certificado de Supabase lo firma una CA propia que Node no trae en su
  // store, así que se valida el canal pero no la cadena.
  const ssl = (sslFlag ? sslFlag === 'true' : Boolean(url))
    ? { rejectUnauthorized: false }
    : false;
  const max = Number(env('DB_POOL_MAX'));
  const pool = Number.isInteger(max) && max > 0 ? { extra: { max } } : {};

  if (url) {
    return { type: 'postgres', url, ssl, ...pool };
  }

  return {
    type: 'postgres',
    host: env('DB_HOST') ?? 'localhost',
    port: Number(env('DB_PORT') ?? 5432),
    username: env('DB_USER') ?? 'postgres',
    password: env('DB_PASSWORD') ?? 'postgres',
    database: env('DB_NAME') ?? 'admin_consorcios',
    ssl,
    ...pool,
  };
}
