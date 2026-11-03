import { MigrationInterface, QueryRunner } from 'typeorm';

export class Outbox1793361600000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE evento_outbox (
      id uuid PRIMARY KEY, routing text NOT NULL, contenido bytea NOT NULL,
      creado_at timestamptz NOT NULL DEFAULT now(), publicado_at timestamptz)`);
    await runner.query('CREATE INDEX evento_outbox_pendientes ON evento_outbox(creado_at) WHERE publicado_at IS NULL');
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE evento_outbox');
  }
}
