// GENERADO por `pnpm back db:generate-entities` — no editar a mano.
// Refleja la tabla `gasto` de la base.

import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { NaturalezaGasto } from './enums';
import { numericTransformer } from '../transformers';
import { BoletaDetalle } from './boleta_detalle.entity';
import { Liquidacion } from './liquidacion.entity';
import { Proveedor } from './proveedor.entity';
import { Reclamo } from './reclamo.entity';
import { RubroGasto } from './rubro_gasto.entity';
import { Votacion } from './votacion.entity';

@Entity('gasto')
export class Gasto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'liquidacion_id' })
  liquidacionId: string;

  @ManyToOne(() => Liquidacion, undefined, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'liquidacion_id' })
  liquidacion: Liquidacion;

  @Column({ type: 'uuid', name: 'rubro_id' })
  rubroId: string;

  @ManyToOne(() => RubroGasto, undefined, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'rubro_id' })
  rubro: RubroGasto;

  @Column({ type: 'uuid', name: 'proveedor_id', nullable: true })
  proveedorId: string | null;

  @ManyToOne(() => Proveedor, undefined, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'proveedor_id' })
  proveedor?: Proveedor | null;

  @Column({ type: 'uuid', name: 'votacion_id', nullable: true })
  votacionId: string | null;

  @ManyToOne(() => Votacion, undefined, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'votacion_id' })
  votacion?: Votacion | null;

  @Column({ type: 'uuid', name: 'reclamo_id', nullable: true })
  reclamoId: string | null;

  @ManyToOne(() => Reclamo, undefined, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reclamo_id' })
  reclamo?: Reclamo | null;

  @Column({ type: 'varchar', name: 'descripcion', length: 200 })
  descripcion: string;

  @Column({ type: 'numeric', name: 'monto', precision: 14, scale: 2, transformer: numericTransformer })
  monto: number;

  @Column({ type: 'enum', enum: NaturalezaGasto, enumName: 'naturaleza_gasto', name: 'naturaleza', default: 'ORDINARIO' })
  naturaleza: NaturalezaGasto;

  @Column({ type: 'text', name: 'comprobante_url', nullable: true })
  comprobanteUrl: string | null;

  @Column({ type: 'varchar', name: 'comprobante_numero', length: 50, nullable: true })
  comprobanteNumero: string | null;

  @Column({ type: 'smallint', name: 'cuota_numero', nullable: true })
  cuotaNumero: number | null;

  @Column({ type: 'smallint', name: 'cuota_total', nullable: true })
  cuotaTotal: number | null;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'updated_at', default: () => 'now()' })
  updatedAt: Date;

  @OneToMany(() => BoletaDetalle, (row) => row.gasto)
  boletaDetalles?: BoletaDetalle[];
}
