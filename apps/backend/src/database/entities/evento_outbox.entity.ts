// GENERADO por `pnpm back db:generate-entities` — no editar a mano.
// Refleja la tabla `evento_outbox` de la base.

import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('evento_outbox')
export class EventoOutbox {
  @PrimaryColumn({ type: 'uuid', name: 'id' })
  id: string;

  @Column({ type: 'text', name: 'routing' })
  routing: string;

  @Column({ type: 'bytea', name: 'contenido' })
  contenido: Buffer;

  @Column({ type: 'timestamptz', name: 'creado_at', default: () => 'now()' })
  creadoAt: Date;

  @Column({ type: 'timestamptz', name: 'publicado_at', nullable: true })
  publicadoAt: Date | null;
}
