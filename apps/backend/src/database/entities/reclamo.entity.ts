// GENERADO por `pnpm back db:generate-entities` — no editar a mano.
// Refleja la tabla `reclamo` de la base.

import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { EstadoReclamo, PrioridadReclamo } from './enums';
import { CategoriaReclamo } from './categoria_reclamo.entity';
import { Consorcio } from './consorcio.entity';
import { Gasto } from './gasto.entity';
import { Proveedor } from './proveedor.entity';
import { ReclamoAdjunto } from './reclamo_adjunto.entity';
import { ReclamoEvento } from './reclamo_evento.entity';
import { Unidad } from './unidad.entity';
import { Usuario } from './usuario.entity';

@Index('reclamo_codigo_key', ['codigo'], { unique: true })
@Entity('reclamo')
export class Reclamo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', name: 'codigo', length: 20 })
  codigo: string;

  @Column({ type: 'uuid', name: 'consorcio_id' })
  consorcioId: string;

  @ManyToOne(() => Consorcio, undefined, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'consorcio_id' })
  consorcio: Consorcio;

  @Column({ type: 'uuid', name: 'unidad_id' })
  unidadId: string;

  @ManyToOne(() => Unidad, undefined, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'unidad_id' })
  unidad: Unidad;

  @Column({ type: 'uuid', name: 'creado_por' })
  creadoPorId: string;

  @ManyToOne(() => Usuario, undefined, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'creado_por' })
  creadoPor: Usuario;

  @Column({ type: 'uuid', name: 'categoria_id' })
  categoriaId: string;

  @ManyToOne(() => CategoriaReclamo, undefined, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'categoria_id' })
  categoria: CategoriaReclamo;

  @Column({ type: 'uuid', name: 'proveedor_id', nullable: true })
  proveedorId: string | null;

  @ManyToOne(() => Proveedor, undefined, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'proveedor_id' })
  proveedor?: Proveedor | null;

  @Column({ type: 'text', name: 'descripcion' })
  descripcion: string;

  @Column({ type: 'enum', enum: PrioridadReclamo, enumName: 'prioridad_reclamo', name: 'prioridad', default: 'MEDIA' })
  prioridad: PrioridadReclamo;

  @Column({ type: 'enum', enum: EstadoReclamo, enumName: 'estado_reclamo', name: 'estado', default: 'NUEVO' })
  estado: EstadoReclamo;

  @Column({ type: 'timestamptz', name: 'cerrado_at', nullable: true })
  cerradoAt: Date | null;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'updated_at', default: () => 'now()' })
  updatedAt: Date;

  @OneToMany(() => Gasto, (row) => row.reclamo)
  gastos?: Gasto[];

  @OneToMany(() => ReclamoAdjunto, (row) => row.reclamo)
  reclamoAdjuntos?: ReclamoAdjunto[];

  @OneToMany(() => ReclamoEvento, (row) => row.reclamo)
  reclamoEventos?: ReclamoEvento[];
}
