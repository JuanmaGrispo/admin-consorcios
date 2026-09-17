// GENERADO por `pnpm back db:generate-entities` — no editar a mano.
// Refleja la tabla `reclamo_evento` de la base.

import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { EstadoReclamo, TipoEventoReclamo } from './enums';
import { Reclamo } from './reclamo.entity';
import { Usuario } from './usuario.entity';

@Entity('reclamo_evento')
export class ReclamoEvento {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'reclamo_id' })
  reclamoId: string;

  @ManyToOne(() => Reclamo, undefined, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reclamo_id' })
  reclamo: Reclamo;

  @Column({ type: 'uuid', name: 'autor_id' })
  autorId: string;

  @ManyToOne(() => Usuario, undefined, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'autor_id' })
  autor: Usuario;

  @Column({ type: 'enum', enum: TipoEventoReclamo, enumName: 'tipo_evento_reclamo', name: 'tipo' })
  tipo: TipoEventoReclamo;

  @Column({ type: 'text', name: 'mensaje', nullable: true })
  mensaje: string | null;

  @Column({ type: 'enum', enum: EstadoReclamo, enumName: 'estado_reclamo', name: 'estado_anterior', nullable: true })
  estadoAnterior: EstadoReclamo | null;

  @Column({ type: 'enum', enum: EstadoReclamo, enumName: 'estado_reclamo', name: 'estado_nuevo', nullable: true })
  estadoNuevo: EstadoReclamo | null;

  @Column({ type: 'boolean', name: 'visible_para_vecino', default: true })
  visibleParaVecino: boolean;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;
}
