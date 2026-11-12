import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Registro del asistente de ayuda y el interruptor de la plataforma. Las
 * interacciones se borran con la cuenta (Ley 25.326) y no guardan datos
 * personales: la pregunta llega ya redactada.
 */
export class Asistente1794500000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE asistente_interaccion (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
      conversacion_id uuid NOT NULL,
      pregunta varchar(500) NOT NULL,
      respuesta jsonb,
      origen varchar(10) NOT NULL CHECK (origen IN ('llm', 'manual', 'rechazo')),
      herramientas jsonb NOT NULL DEFAULT '[]',
      modelo varchar(40),
      tokens_entrada integer NOT NULL DEFAULT 0,
      tokens_cache integer NOT NULL DEFAULT 0,
      tokens_salida integer NOT NULL DEFAULT 0,
      costo_usd numeric(10,6) NOT NULL DEFAULT 0,
      latencia_ms integer NOT NULL DEFAULT 0,
      error varchar(200),
      creado_at timestamptz NOT NULL DEFAULT now())`);
    await runner.query('CREATE INDEX asistente_interaccion_usuario ON asistente_interaccion(usuario_id, creado_at)');
    await runner.query('CREATE INDEX asistente_interaccion_conversacion ON asistente_interaccion(conversacion_id, creado_at)');
    await runner.query('CREATE INDEX asistente_interaccion_creado ON asistente_interaccion(creado_at)');

    await runner.query(`CREATE TABLE asistente_feedback (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      interaccion_id uuid NOT NULL UNIQUE REFERENCES asistente_interaccion(id) ON DELETE CASCADE,
      util boolean NOT NULL,
      comentario varchar(500),
      creado_at timestamptz NOT NULL DEFAULT now())`);

    await runner.query(`CREATE TABLE configuracion_plataforma (
      clave varchar(60) PRIMARY KEY,
      valor jsonb NOT NULL,
      actualizado_at timestamptz NOT NULL DEFAULT now(),
      actualizado_por uuid REFERENCES usuario(id) ON DELETE SET NULL)`);
    await runner.query(`INSERT INTO configuracion_plataforma (clave, valor) VALUES ('asistente_habilitado', 'true')`);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE configuracion_plataforma');
    await runner.query('DROP TABLE asistente_feedback');
    await runner.query('DROP TABLE asistente_interaccion');
  }
}
