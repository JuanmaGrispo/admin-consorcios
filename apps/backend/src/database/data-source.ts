import 'dotenv/config';
import { DataSource } from 'typeorm';

/**
 * DataSource para la CLI de TypeORM (migraciones). La app NO usa este archivo:
 * se conecta vía DatabaseModule. Ambos leen las mismas variables de entorno,
 * así que apuntan siempre a la misma base.
 */
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'admin_consorcios',
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
});
