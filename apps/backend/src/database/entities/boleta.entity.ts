// GENERADO por `pnpm back db:generate-entities` — no editar a mano.
// Refleja la tabla `boleta` de la base.

import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { EstadoBoleta } from './enums';
import { numericTransformer } from '../transformers';
import { BoletaDetalle } from './boleta_detalle.entity';
import { Liquidacion } from './liquidacion.entity';
import { Pago } from './pago.entity';
import { Unidad } from './unidad.entity';

@Index('uq_boleta_unidad', ['liquidacionId', 'unidadId'], { unique: true })
@Entity('boleta')
export class Boleta {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'liquidacion_id' })
  liquidacionId: string;

  @ManyToOne(() => Liquidacion, undefined, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'liquidacion_id' })
  liquidacion: Liquidacion;

  @Column({ type: 'uuid', name: 'unidad_id' })
  unidadId: string;

  @ManyToOne(() => Unidad, undefined, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'unidad_id' })
  unidad: Unidad;

  @Column({ type: 'numeric', name: 'coeficiente_aplicado', precision: 7, scale: 4, transformer: numericTransformer })
  coeficienteAplicado: number;

  @Column({ type: 'numeric', name: 'importe_ordinarias', precision: 14, scale: 2, transformer: numericTransformer, default: 0 })
  importeOrdinarias: number;

  @Column({ type: 'numeric', name: 'importe_extraordinarias', precision: 14, scale: 2, transformer: numericTransformer, default: 0 })
  importeExtraordinarias: number;

  @Column({ type: 'numeric', name: 'fondo_reserva', precision: 14, scale: 2, transformer: numericTransformer, default: 0 })
  fondoReserva: number;

  @Column({ type: 'numeric', name: 'saldo_anterior', precision: 14, scale: 2, transformer: numericTransformer, default: 0 })
  saldoAnterior: number;

  @Column({ type: 'numeric', name: 'intereses_mora', precision: 14, scale: 2, transformer: numericTransformer, default: 0 })
  interesesMora: number;

  @Column({ type: 'numeric', name: 'ajuste_manual', precision: 14, scale: 2, transformer: numericTransformer, default: 0 })
  ajusteManual: number;

  @Column({ type: 'varchar', name: 'motivo_ajuste', length: 200, nullable: true })
  motivoAjuste: string | null;

  @Column({ type: 'numeric', name: 'total', precision: 14, scale: 2, transformer: numericTransformer, default: 0 })
  total: number;

  @Column({ type: 'enum', enum: EstadoBoleta, enumName: 'estado_boleta', name: 'estado', default: 'PENDIENTE' })
  estado: EstadoBoleta;

  @Column({ type: 'text', name: 'pdf_url', nullable: true })
  pdfUrl: string | null;

  @Column({ type: 'timestamptz', name: 'enviada_at', nullable: true })
  enviadaAt: Date | null;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'updated_at', default: () => 'now()' })
  updatedAt: Date;

  @OneToMany(() => BoletaDetalle, (row) => row.boleta)
  boletaDetalles?: BoletaDetalle[];

  @OneToMany(() => Pago, (row) => row.boleta)
  pagos?: Pago[];
}
