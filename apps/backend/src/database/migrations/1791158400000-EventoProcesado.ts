import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Qué evento ya procesó cada consumidor de RabbitMQ. El broker entrega "al
 * menos una vez": un reintento o una reconexión pueden repetir un mensaje, y
 * el muro no puede publicar dos veces la misma novedad. El consumidor guarda
 * su efecto y esta marca en la misma transacción.
 */
export class EventoProcesado1791158400000 implements MigrationInterface {
  name = 'EventoProcesado1791158400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS evento_procesado (
        evento_id uuid NOT NULL,
        consumidor varchar(60) NOT NULL,
        procesado_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_evento_procesado PRIMARY KEY (evento_id, consumidor)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS evento_procesado');
  }
}
