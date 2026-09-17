import 'dotenv/config';
import { DataSource } from 'typeorm';
import { buildConnectionOptions } from './database.options';

/**
 * DataSource para la CLI de TypeORM (migraciones). La app NO usa este archivo:
 * se conecta vía DatabaseModule. Ambos leen las mismas variables de entorno,
 * así que apuntan siempre a la misma base.
 */
export default new DataSource({
  ...buildConnectionOptions((key) => process.env[key]),
  entities: ['src/database/entities/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
});
