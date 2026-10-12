import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A qué proveedor se asignó el reclamo en cada evento de la línea de tiempo
 * ("Asignado a Gasparini Servicios", pantalla 04). Hasta ahora sólo se sabía
 * el proveedor vigente, así que las asignaciones anteriores salían sin nombre.
 *
 * Null en los eventos que no son de asignación y en los viejos. Si se borra el
 * proveedor, el evento queda pero sin el vínculo.
 */
export class ProveedorEnEventoDeReclamo1791800000002 implements MigrationInterface {
  name = 'ProveedorEnEventoDeReclamo1791800000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE reclamo_evento
        ADD COLUMN proveedor_id uuid NULL,
        ADD CONSTRAINT fk_reclamo_evento_proveedor
          FOREIGN KEY (proveedor_id) REFERENCES proveedor(id) ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE reclamo_evento
        DROP CONSTRAINT fk_reclamo_evento_proveedor,
        DROP COLUMN proveedor_id
    `);
  }
}
