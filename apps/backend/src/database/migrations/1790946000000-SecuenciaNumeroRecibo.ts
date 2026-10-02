import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * La secuencia de la que sale el número de recibo de un pago aprobado
 * (`pago.recibo_numero`, que ya existe en la tabla). Es una secuencia y no un
 * `max(...) + 1` porque dos pagos aprobados en el mismo instante —el webhook
 * de Mercado Pago y un pago manual— se llevarían el mismo número.
 *
 * No toca ninguna tabla, así que las entities generadas no cambian.
 *
 * El punto de venta queda fijo en 0001: cuando cada administrador tenga el
 * suyo, pasa a ser una columna del consorcio y la secuencia se vuelve una por
 * punto de venta.
 */
export class SecuenciaNumeroRecibo1790946000000 implements MigrationInterface {
  name = 'SecuenciaNumeroRecibo1790946000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE SEQUENCE IF NOT EXISTS recibo_pago_numero START 1');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP SEQUENCE IF EXISTS recibo_pago_numero');
  }
}
