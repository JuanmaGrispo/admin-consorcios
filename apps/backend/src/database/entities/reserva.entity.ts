// GENERADO por `pnpm back db:generate-entities` — no editar a mano.
// Refleja la tabla `reserva` de la base.

import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { EstadoReserva } from './enums';
import { Amenity } from './amenity.entity';
import { Pago } from './pago.entity';
import { Unidad } from './unidad.entity';
import { Usuario } from './usuario.entity';

@Entity('reserva')
export class Reserva {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'amenity_id' })
  amenityId: string;

  @ManyToOne(() => Amenity, undefined, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'amenity_id' })
  amenity: Amenity;

  @Column({ type: 'uuid', name: 'unidad_id' })
  unidadId: string;

  @ManyToOne(() => Unidad, undefined, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'unidad_id' })
  unidad: Unidad;

  @Column({ type: 'uuid', name: 'solicitada_por' })
  solicitadaPorId: string;

  @ManyToOne(() => Usuario, undefined, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'solicitada_por' })
  solicitadaPor: Usuario;

  @Column({ type: 'uuid', name: 'resuelta_por', nullable: true })
  resueltaPorId: string | null;

  @ManyToOne(() => Usuario, undefined, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'resuelta_por' })
  resueltaPor?: Usuario | null;

  @Column({ type: 'timestamptz', name: 'inicio' })
  inicio: Date;

  @Column({ type: 'timestamptz', name: 'fin' })
  fin: Date;

  @Column({ type: 'enum', enum: EstadoReserva, enumName: 'estado_reserva', name: 'estado', default: 'PENDIENTE' })
  estado: EstadoReserva;

  @Column({ type: 'varchar', name: 'motivo', length: 120, nullable: true })
  motivo: string | null;

  @Column({ type: 'varchar', name: 'motivo_rechazo', length: 200, nullable: true })
  motivoRechazo: string | null;

  @Column({ type: 'timestamptz', name: 'resuelta_at', nullable: true })
  resueltaAt: Date | null;

  @Column({ type: 'timestamptz', name: 'sena_devuelta_at', nullable: true })
  senaDevueltaAt: Date | null;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'updated_at', default: () => 'now()' })
  updatedAt: Date;

  @OneToMany(() => Pago, (row) => row.reserva)
  pagos?: Pago[];
}
