import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * El horario de un amenity puede cambiar según el día (el SUM abre hasta las
 * 02:00 sólo viernes y sábado, pantalla 05). `horario_semanal` guarda las
 * excepciones al horario general, por día de la semana ISO (1 lunes … 7
 * domingo):
 *
 *   { "5": { "apertura": "10:00", "cierre": "02:00" }, "7": null }
 *
 * Un día con `null` está cerrado; un día que no figura usa `hora_apertura` y
 * `hora_cierre`. Null en la columna es "todos los días igual", que es como se
 * comportan los amenities que ya existen.
 */
export class HorarioSemanalDeAmenity1791800000003 implements MigrationInterface {
  name = 'HorarioSemanalDeAmenity1791800000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE amenity
        ADD COLUMN horario_semanal jsonb NULL,
        ADD CONSTRAINT ck_amenity_horario_semanal CHECK (jsonb_typeof(horario_semanal) = 'object')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE amenity
        DROP CONSTRAINT ck_amenity_horario_semanal,
        DROP COLUMN horario_semanal
    `);
  }
}
