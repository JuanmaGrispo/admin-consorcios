import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cuándo salió el recordatorio de 48 h de una asamblea. Marcarlo con el mismo
 * UPDATE que la elige es lo que garantiza que salga una sola vez, aunque dos
 * instancias del backend corran el cron a la vez.
 */
export class RecordatorioAsamblea1791158400001 implements MigrationInterface {
  name = 'RecordatorioAsamblea1791158400001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE asamblea ADD COLUMN IF NOT EXISTS recordatorio_enviado_at timestamptz NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE asamblea DROP COLUMN IF EXISTS recordatorio_enviado_at');
  }
}
