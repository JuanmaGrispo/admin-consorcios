import { MigrationInterface, QueryRunner } from 'typeorm';

/** La secuencia no retiene un lock global mientras se guarda cada reclamo. */
export class NumeracionReclamos1793620800001 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query('CREATE SEQUENCE reclamo_numero');
    await runner.query(`SELECT setval('reclamo_numero', GREATEST(1, COALESCE(
      (SELECT max(substring(codigo FROM '[0-9]+$')::bigint) + 1 FROM reclamo WHERE codigo ~ '^RC-[0-9]{4}-[0-9]+$'), 1)), false)`);
  }
  async down(runner: QueryRunner): Promise<void> { await runner.query('DROP SEQUENCE reclamo_numero'); }
}
