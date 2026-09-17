// GENERADO por `pnpm back db:generate-entities` — no editar a mano.
// Refleja la tabla `pago` de la base.

import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ConceptoPago, EstadoPago, MedioPago } from './enums';
import { numericTransformer } from '../transformers';
import { Boleta } from './boleta.entity';
import { Reserva } from './reserva.entity';
import { Unidad } from './unidad.entity';
import { Usuario } from './usuario.entity';

@Index('pago_mp_payment_id_key', ['mpPaymentId'], { unique: true })
@Entity('pago')
export class Pago {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ConceptoPago, enumName: 'concepto_pago', name: 'concepto' })
  concepto: ConceptoPago;

  @Column({ type: 'uuid', name: 'boleta_id', nullable: true })
  boletaId: string | null;

  @ManyToOne(() => Boleta, undefined, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'boleta_id' })
  boleta?: Boleta | null;

  @Column({ type: 'uuid', name: 'reserva_id', nullable: true })
  reservaId: string | null;

  @ManyToOne(() => Reserva, undefined, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'reserva_id' })
  reserva?: Reserva | null;

  @Column({ type: 'uuid', name: 'unidad_id' })
  unidadId: string;

  @ManyToOne(() => Unidad, undefined, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'unidad_id' })
  unidad: Unidad;

  @Column({ type: 'uuid', name: 'registrado_por', nullable: true })
  registradoPorId: string | null;

  @ManyToOne(() => Usuario, undefined, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'registrado_por' })
  registradoPor?: Usuario | null;

  @Column({ type: 'numeric', name: 'monto', precision: 14, scale: 2, transformer: numericTransformer })
  monto: number;

  @Column({ type: 'enum', enum: MedioPago, enumName: 'medio_pago', name: 'medio' })
  medio: MedioPago;

  @Column({ type: 'enum', enum: EstadoPago, enumName: 'estado_pago', name: 'estado', default: 'PENDIENTE' })
  estado: EstadoPago;

  @Column({ type: 'timestamptz', name: 'fecha_pago', nullable: true })
  fechaPago: Date | null;

  @Column({ type: 'varchar', name: 'mp_preference_id', length: 80, nullable: true })
  mpPreferenceId: string | null;

  @Column({ type: 'varchar', name: 'mp_payment_id', length: 80, nullable: true })
  mpPaymentId: string | null;

  @Column({ type: 'varchar', name: 'mp_status_detail', length: 60, nullable: true })
  mpStatusDetail: string | null;

  @Column({ type: 'varchar', name: 'recibo_numero', length: 30, nullable: true })
  reciboNumero: string | null;

  @Column({ type: 'text', name: 'recibo_url', nullable: true })
  reciboUrl: string | null;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'updated_at', default: () => 'now()' })
  updatedAt: Date;
}
