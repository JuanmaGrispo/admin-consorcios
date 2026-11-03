import { MigrationInterface, QueryRunner } from 'typeorm';

export class ContratosRest1793620800000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE solicitud_idempotente (
      usuario_id uuid NOT NULL REFERENCES usuario(id), metodo text NOT NULL, ruta text NOT NULL,
      clave varchar(128) NOT NULL, huella text NOT NULL, estado_http integer NOT NULL,
      respuesta jsonb NOT NULL, cabeceras jsonb NOT NULL DEFAULT '{}',
      creado_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY(usuario_id, metodo, ruta, clave))`);
    await runner.query('ALTER TABLE consorcio ADD COLUMN version integer NOT NULL DEFAULT 1');
    await runner.query(`CREATE FUNCTION incrementar_version_consorcio() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN NEW.version := OLD.version + 1; RETURN NEW; END $$`);
    await runner.query(`CREATE TRIGGER version_consorcio BEFORE UPDATE ON consorcio
      FOR EACH ROW EXECUTE FUNCTION incrementar_version_consorcio()`);
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TRIGGER version_consorcio ON consorcio');
    await runner.query('DROP FUNCTION incrementar_version_consorcio()');
    await runner.query('ALTER TABLE consorcio DROP COLUMN version');
    await runner.query('DROP TABLE solicitud_idempotente');
  }
}
