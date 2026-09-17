// GENERADO por `pnpm back db:generate-entities` — no editar a mano.
// Refleja la tabla `novedad_adjunto` de la base.

import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TipoAdjunto } from './enums';
import { Novedad } from './novedad.entity';

@Entity('novedad_adjunto')
export class NovedadAdjunto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'novedad_id' })
  novedadId: string;

  @ManyToOne(() => Novedad, undefined, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'novedad_id' })
  novedad: Novedad;

  @Column({ type: 'text', name: 'url' })
  url: string;

  @Column({ type: 'varchar', name: 'nombre', length: 120, nullable: true })
  nombre: string | null;

  @Column({ type: 'enum', enum: TipoAdjunto, enumName: 'tipo_adjunto', name: 'tipo', default: 'OTRO' })
  tipo: TipoAdjunto;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;
}
