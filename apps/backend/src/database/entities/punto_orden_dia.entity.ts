// GENERADO por `pnpm back db:generate-entities` — no editar a mano.
// Refleja la tabla `punto_orden_dia` de la base.

import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { TipoPuntoOrden } from './enums';
import { Asamblea } from './asamblea.entity';
import { Votacion } from './votacion.entity';

@Index('uq_punto_orden', ['asambleaId', 'orden'], { unique: true })
@Entity('punto_orden_dia')
export class PuntoOrdenDia {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'asamblea_id' })
  asambleaId: string;

  @ManyToOne(() => Asamblea, undefined, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'asamblea_id' })
  asamblea: Asamblea;

  @Column({ type: 'smallint', name: 'orden' })
  orden: number;

  @Column({ type: 'varchar', name: 'titulo', length: 150 })
  titulo: string;

  @Column({ type: 'text', name: 'descripcion', nullable: true })
  descripcion: string | null;

  @Column({ type: 'enum', enum: TipoPuntoOrden, enumName: 'tipo_punto_orden', name: 'tipo', default: 'INFORMATIVO' })
  tipo: TipoPuntoOrden;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;

  @OneToMany(() => Votacion, (row) => row.puntoOrdenDia)
  votaciones?: Votacion[];
}
