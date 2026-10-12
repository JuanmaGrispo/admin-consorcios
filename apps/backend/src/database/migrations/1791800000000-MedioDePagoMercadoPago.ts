import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Con qué pagó el vecino por Mercado Pago, para el comprobante ("Visa ····
 * 4417", pantalla 12): hasta ahora sólo se guardaba el estado.
 *
 * - `mp_medio_pago`: el `payment_method_id` de Mercado Pago ("visa",
 *   "master", "account_money").
 * - `mp_ultimos_digitos`: los últimos 4 de la tarjeta, si se pagó con una.
 *
 * Los dos son null en los pagos que no son de Mercado Pago y en los viejos.
 */
export class MedioDePagoMercadoPago1791800000000 implements MigrationInterface {
  name = 'MedioDePagoMercadoPago1791800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE pago
        ADD COLUMN mp_medio_pago varchar(40) NULL,
        ADD COLUMN mp_ultimos_digitos varchar(4) NULL,
        ADD CONSTRAINT ck_pago_ultimos_digitos CHECK (mp_ultimos_digitos ~ '^[0-9]{4}$')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE pago
        DROP CONSTRAINT ck_pago_ultimos_digitos,
        DROP COLUMN mp_medio_pago,
        DROP COLUMN mp_ultimos_digitos
    `);
  }
}
