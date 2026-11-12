// GENERADO por `pnpm back db:generate-entities` — no editar a mano.
// Refleja la tabla `asistente_feedback` de la base.

import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { AsistenteInteraccion } from './asistente_interaccion.entity';

@Index('asistente_feedback_interaccion_id_key', ['interaccionId'], { unique: true })
@Entity('asistente_feedback')
export class AsistenteFeedback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'interaccion_id' })
  interaccionId: string;

  @ManyToOne(() => AsistenteInteraccion, undefined, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'interaccion_id' })
  interaccion: AsistenteInteraccion;

  @Column({ type: 'boolean', name: 'util' })
  util: boolean;

  @Column({ type: 'varchar', name: 'comentario', length: 500, nullable: true })
  comentario: string | null;

  @Column({ type: 'timestamptz', name: 'creado_at', default: () => 'now()' })
  creadoAt: Date;
}
