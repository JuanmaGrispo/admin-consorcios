// GENERADO por `pnpm back db:generate-entities` — no editar a mano.
// Refleja la tabla `evento_procesado` de la base.

import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('evento_procesado')
export class EventoProcesado {
  @PrimaryColumn({ type: 'uuid', name: 'evento_id' })
  eventoId: string;

  @PrimaryColumn({ type: 'varchar', name: 'consumidor' })
  consumidor: string;

  @Column({ type: 'timestamptz', name: 'procesado_at', default: () => 'now()' })
  procesadoAt: Date;
}
