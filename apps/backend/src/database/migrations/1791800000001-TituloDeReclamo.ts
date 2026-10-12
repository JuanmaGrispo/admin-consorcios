import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Un título corto para el reclamo ("Pérdida de agua en el baño"), que es lo
 * que encabeza la tarjeta en las listas (pantallas 04 y 13). Hasta ahora se
 * mostraba la descripción recortada.
 *
 * Es null en la base porque los reclamos que ya existen no tienen: la
 * obligación para los nuevos la pone el DTO de alta.
 */
export class TituloDeReclamo1791800000001 implements MigrationInterface {
  name = 'TituloDeReclamo1791800000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE reclamo
        ADD COLUMN titulo varchar(80) NULL,
        ADD CONSTRAINT ck_reclamo_titulo CHECK (length(trim(titulo)) > 0)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE reclamo DROP CONSTRAINT ck_reclamo_titulo, DROP COLUMN titulo');
  }
}
