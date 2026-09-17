// GENERADO por `pnpm back db:generate-entities` — no editar a mano.
// Refleja la tabla `reclamo_adjunto` de la base.

import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Reclamo } from './reclamo.entity';

@Entity('reclamo_adjunto')
export class ReclamoAdjunto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'reclamo_id' })
  reclamoId: string;

  @ManyToOne(() => Reclamo, undefined, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reclamo_id' })
  reclamo: Reclamo;

  @Column({ type: 'text', name: 'url' })
  url: string;

  @Column({ type: 'varchar', name: 'nombre', length: 120, nullable: true })
  nombre: string | null;

  @Column({ type: 'smallint', name: 'orden', default: 0 })
  orden: number;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;
}
