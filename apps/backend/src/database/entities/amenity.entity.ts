// GENERADO por `pnpm back db:generate-entities` — no editar a mano.
// Refleja la tabla `amenity` de la base.

import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { numericTransformer } from '../transformers';
import { AmenityBloqueo } from './amenity_bloqueo.entity';
import { Consorcio } from './consorcio.entity';
import { Reserva } from './reserva.entity';

@Entity('amenity')
export class Amenity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'consorcio_id' })
  consorcioId: string;

  @ManyToOne(() => Consorcio, undefined, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'consorcio_id' })
  consorcio: Consorcio;

  @Column({ type: 'varchar', name: 'nombre', length: 80 })
  nombre: string;

  @Column({ type: 'varchar', name: 'icono', length: 40, nullable: true })
  icono: string | null;

  @Column({ type: 'smallint', name: 'cupo_personas', nullable: true })
  cupoPersonas: number | null;

  @Column({ type: 'time', name: 'hora_apertura', default: '08:00:00' })
  horaApertura: string;

  @Column({ type: 'time', name: 'hora_cierre', default: '22:00:00' })
  horaCierre: string;

  @Column({ type: 'smallint', name: 'anticipacion_minima_horas', default: 0 })
  anticipacionMinimaHoras: number;

  @Column({ type: 'smallint', name: 'duracion_maxima_horas', nullable: true })
  duracionMaximaHoras: number | null;

  @Column({ type: 'boolean', name: 'requiere_aprobacion', default: true })
  requiereAprobacion: boolean;

  @Column({ type: 'numeric', name: 'monto_sena', precision: 14, scale: 2, transformer: numericTransformer, default: 0 })
  montoSena: number;

  @Column({ type: 'smallint', name: 'dias_devolucion_sena', default: 0 })
  diasDevolucionSena: number;

  @Column({ type: 'boolean', name: 'bloquea_con_deuda', default: false })
  bloqueaConDeuda: boolean;

  @Column({ type: 'boolean', name: 'activo', default: true })
  activo: boolean;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'updated_at', default: () => 'now()' })
  updatedAt: Date;

  @OneToMany(() => AmenityBloqueo, (row) => row.amenity)
  amenityBloqueos?: AmenityBloqueo[];

  @OneToMany(() => Reserva, (row) => row.amenity)
  reservas?: Reserva[];
}
