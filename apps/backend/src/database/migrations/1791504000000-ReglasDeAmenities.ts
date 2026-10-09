import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lo que el diseño pide configurar en cada amenity y la base no tenía:
 *
 * - `reglamento`: las reglas en texto libre que el vecino ve antes de confirmar.
 * - `duracion_franja_minutos`: si se reserva por turnos fijos ("franjas de 4
 *   horas") desde la apertura. Null es horario libre.
 * - `cancelacion_minima_horas`: hasta cuántas horas antes el vecino puede cancelar.
 * - `lugares`: cuántas reservas simultáneas admite (la cochera de visitas tiene 2).
 *
 * Para los lugares, cada reserva ocupa un `lugar` concreto y la exclusión de
 * solapamiento pasa a ser por (amenity, lugar): la base sigue garantizando que
 * dos reservas no se pisen, ahora dentro de cada lugar. Con `lugares = 1` y
 * `lugar = 1` (los defaults) se comporta igual que antes.
 */
export class ReglasDeAmenities1791504000000 implements MigrationInterface {
  name = 'ReglasDeAmenities1791504000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE amenity
        ADD COLUMN reglamento text NULL,
        ADD COLUMN duracion_franja_minutos integer NULL,
        ADD COLUMN cancelacion_minima_horas integer NOT NULL DEFAULT 0,
        ADD COLUMN lugares integer NOT NULL DEFAULT 1,
        ADD CONSTRAINT ck_amenity_franja CHECK (duracion_franja_minutos > 0),
        ADD CONSTRAINT ck_amenity_cancelacion CHECK (cancelacion_minima_horas >= 0),
        ADD CONSTRAINT ck_amenity_lugares CHECK (lugares >= 1)
    `);
    await queryRunner.query(`
      ALTER TABLE reserva
        ADD COLUMN lugar integer NOT NULL DEFAULT 1,
        ADD CONSTRAINT ck_reserva_lugar CHECK (lugar >= 1)
    `);
    await queryRunner.query('ALTER TABLE reserva DROP CONSTRAINT ex_reserva_solapada');
    await queryRunner.query(`
      ALTER TABLE reserva ADD CONSTRAINT ex_reserva_solapada
        EXCLUDE USING gist (amenity_id WITH =, lugar WITH =, tstzrange(inicio, fin) WITH &&)
        WHERE (estado IN ('PENDIENTE', 'APROBADA'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE reserva DROP CONSTRAINT ex_reserva_solapada');
    await queryRunner.query(`
      ALTER TABLE reserva ADD CONSTRAINT ex_reserva_solapada
        EXCLUDE USING gist (amenity_id WITH =, tstzrange(inicio, fin) WITH &&)
        WHERE (estado IN ('PENDIENTE', 'APROBADA'))
    `);
    await queryRunner.query('ALTER TABLE reserva DROP CONSTRAINT ck_reserva_lugar, DROP COLUMN lugar');
    await queryRunner.query(`
      ALTER TABLE amenity
        DROP CONSTRAINT ck_amenity_franja,
        DROP CONSTRAINT ck_amenity_cancelacion,
        DROP CONSTRAINT ck_amenity_lugares,
        DROP COLUMN reglamento,
        DROP COLUMN duracion_franja_minutos,
        DROP COLUMN cancelacion_minima_horas,
        DROP COLUMN lugares
    `);
  }
}
