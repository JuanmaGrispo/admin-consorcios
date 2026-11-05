import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { EventoDomus, validarSobre } from './eventos';

/** Uso dentro de la misma transacción que modifica el recurso de negocio. */
export async function registrarEventos(manager: EntityManager, eventos: EventoDomus[]): Promise<void> {
  for (const evento of eventos) {
    if (!validarSobre(evento)) throw new Error('El evento no cumple su contrato');
    await manager.query(`INSERT INTO evento_outbox(id,routing,contenido) VALUES ($1,$2,$3)`,
      [evento.evento_id, evento.tipo_evento, Buffer.from(JSON.stringify(evento))]);
  }
}

@Injectable()
export class OutboxRepository {
  constructor(private readonly db: DataSource) {}

  async guardar(id: string, routing: string, contenido: Buffer): Promise<void> {
    await this.db.query(`INSERT INTO evento_outbox(id, routing, contenido) VALUES ($1,$2,$3)
      ON CONFLICT (id) DO NOTHING`, [id, routing, contenido]);
  }

  async despachar(enviar: (routing: string, contenido: Buffer, id: string) => Promise<unknown>): Promise<void> {
    await this.db.transaction(async (m) => {
      const filas: { id: string; routing: string; contenido: Buffer }[] = await m.query(
        'SELECT id, routing, contenido FROM evento_outbox WHERE publicado_at IS NULL ORDER BY creado_at LIMIT 20 FOR UPDATE SKIP LOCKED',
      );
      for (const fila of filas) {
        await enviar(fila.routing, fila.contenido, fila.id);
        await m.query('UPDATE evento_outbox SET publicado_at=now() WHERE id=$1', [fila.id]);
      }
    });
  }
}
