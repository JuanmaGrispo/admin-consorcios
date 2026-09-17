// GENERADO por `pnpm back db:generate-entities` — no editar a mano.
// Refleja la tabla `asistencia` de la base.

import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { EstadoAsistencia } from './enums';
import { numericTransformer } from '../transformers';
import { Asamblea } from './asamblea.entity';
import { Unidad } from './unidad.entity';
import { Usuario } from './usuario.entity';

@Index('uq_asistencia', ['asambleaId', 'unidadId'], { unique: true })
@Entity('asistencia')
export class Asistencia {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'asamblea_id' })
  asambleaId: string;

  @ManyToOne(() => Asamblea, undefined, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'asamblea_id' })
  asamblea: Asamblea;

  @Column({ type: 'uuid', name: 'unidad_id' })
  unidadId: string;

  @ManyToOne(() => Unidad, undefined, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'unidad_id' })
  unidad: Unidad;

  @Column({ type: 'uuid', name: 'apoderado_unidad_id', nullable: true })
  apoderadoUnidadId: string | null;

  @ManyToOne(() => Unidad, undefined, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'apoderado_unidad_id' })
  apoderadoUnidad?: Unidad | null;

  @Column({ type: 'uuid', name: 'confirmada_por', nullable: true })
  confirmadaPorId: string | null;

  @ManyToOne(() => Usuario, undefined, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'confirmada_por' })
  confirmadaPor?: Usuario | null;

  @Column({ type: 'enum', enum: EstadoAsistencia, enumName: 'estado_asistencia', name: 'estado', default: 'SIN_RESPONDER' })
  estado: EstadoAsistencia;

  @Column({ type: 'numeric', name: 'coeficiente_aplicado', precision: 7, scale: 4, transformer: numericTransformer })
  coeficienteAplicado: number;

  @Column({ type: 'timestamptz', name: 'confirmada_at', nullable: true })
  confirmadaAt: Date | null;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'updated_at', default: () => 'now()' })
  updatedAt: Date;
}
