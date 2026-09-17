// GENERADO por `pnpm back db:generate-entities` — no editar a mano.
// Refleja la tabla `asamblea` de la base.

import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { EstadoAsamblea, ModalidadAsamblea, TipoAsamblea } from './enums';
import { numericTransformer } from '../transformers';
import { Asistencia } from './asistencia.entity';
import { Consorcio } from './consorcio.entity';
import { PuntoOrdenDia } from './punto_orden_dia.entity';
import { Usuario } from './usuario.entity';
import { Votacion } from './votacion.entity';

@Entity('asamblea')
export class Asamblea {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'consorcio_id' })
  consorcioId: string;

  @ManyToOne(() => Consorcio, undefined, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'consorcio_id' })
  consorcio: Consorcio;

  @Column({ type: 'uuid', name: 'creada_por' })
  creadaPorId: string;

  @ManyToOne(() => Usuario, undefined, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'creada_por' })
  creadaPor: Usuario;

  @Column({ type: 'varchar', name: 'titulo', length: 150 })
  titulo: string;

  @Column({ type: 'enum', enum: TipoAsamblea, enumName: 'tipo_asamblea', name: 'tipo', default: 'ORDINARIA' })
  tipo: TipoAsamblea;

  @Column({ type: 'enum', enum: ModalidadAsamblea, enumName: 'modalidad_asamblea', name: 'modalidad', default: 'PRESENCIAL' })
  modalidad: ModalidadAsamblea;

  @Column({ type: 'timestamptz', name: 'fecha_hora' })
  fechaHora: Date;

  @Column({ type: 'varchar', name: 'lugar', length: 120, nullable: true })
  lugar: string | null;

  @Column({ type: 'text', name: 'link_videollamada', nullable: true })
  linkVideollamada: string | null;

  @Column({ type: 'numeric', name: 'quorum_requerido', precision: 5, scale: 2, transformer: numericTransformer, default: 60.00 })
  quorumRequerido: number;

  @Column({ type: 'enum', enum: EstadoAsamblea, enumName: 'estado_asamblea', name: 'estado', default: 'BORRADOR' })
  estado: EstadoAsamblea;

  @Column({ type: 'text', name: 'acta_url', nullable: true })
  actaUrl: string | null;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'updated_at', default: () => 'now()' })
  updatedAt: Date;

  @OneToMany(() => Asistencia, (row) => row.asamblea)
  asistencias?: Asistencia[];

  @OneToMany(() => PuntoOrdenDia, (row) => row.asamblea)
  puntoOrdenDias?: PuntoOrdenDia[];

  @OneToMany(() => Votacion, (row) => row.asamblea)
  votaciones?: Votacion[];
}
