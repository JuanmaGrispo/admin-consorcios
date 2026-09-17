// GENERADO por `pnpm back db:generate-entities` — no editar a mano.
// Refleja la tabla `consorcio` de la base.

import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { PeriodicidadMora } from './enums';
import { numericTransformer } from '../transformers';
import { Amenity } from './amenity.entity';
import { Asamblea } from './asamblea.entity';
import { CategoriaReclamo } from './categoria_reclamo.entity';
import { Liquidacion } from './liquidacion.entity';
import { Novedad } from './novedad.entity';
import { Proveedor } from './proveedor.entity';
import { Reclamo } from './reclamo.entity';
import { RubroGasto } from './rubro_gasto.entity';
import { Unidad } from './unidad.entity';
import { Usuario } from './usuario.entity';
import { Votacion } from './votacion.entity';

@Entity('consorcio')
export class Consorcio {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'administrador_id' })
  administradorId: string;

  @ManyToOne(() => Usuario, undefined, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'administrador_id' })
  administrador: Usuario;

  @Column({ type: 'varchar', name: 'nombre', length: 120 })
  nombre: string;

  @Column({ type: 'varchar', name: 'calle', length: 120, nullable: true })
  calle: string | null;

  @Column({ type: 'varchar', name: 'numero', length: 10, nullable: true })
  numero: string | null;

  @Column({ type: 'varchar', name: 'barrio', length: 80, nullable: true })
  barrio: string | null;

  @Column({ type: 'varchar', name: 'ciudad', length: 80, nullable: true })
  ciudad: string | null;

  @Column({ type: 'varchar', name: 'provincia', length: 80, nullable: true })
  provincia: string | null;

  @Column({ type: 'varchar', name: 'cp', length: 10, nullable: true })
  cp: string | null;

  @Column({ type: 'varchar', name: 'cuit', length: 13, nullable: true })
  cuit: string | null;

  @Column({ type: 'varchar', name: 'cbu', length: 22, nullable: true })
  cbu: string | null;

  @Column({ type: 'smallint', name: 'dia_vencimiento', default: 10 })
  diaVencimiento: number;

  @Column({ type: 'numeric', name: 'tasa_interes_mora', precision: 5, scale: 2, transformer: numericTransformer, default: 0 })
  tasaInteresMora: number;

  @Column({ type: 'enum', enum: PeriodicidadMora, enumName: 'periodicidad_mora', name: 'periodicidad_mora', default: 'MENSUAL' })
  periodicidadMora: PeriodicidadMora;

  @Column({ type: 'numeric', name: 'porcentaje_fondo_reserva', precision: 5, scale: 2, transformer: numericTransformer, default: 5.00 })
  porcentajeFondoReserva: number;

  @Column({ type: 'numeric', name: 'quorum_default', precision: 5, scale: 2, transformer: numericTransformer, default: 60.00 })
  quorumDefault: number;

  @Column({ type: 'boolean', name: 'activo', default: true })
  activo: boolean;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'updated_at', default: () => 'now()' })
  updatedAt: Date;

  @OneToMany(() => Amenity, (row) => row.consorcio)
  amenityes?: Amenity[];

  @OneToMany(() => Asamblea, (row) => row.consorcio)
  asambleas?: Asamblea[];

  @OneToMany(() => CategoriaReclamo, (row) => row.consorcio)
  categoriaReclamos?: CategoriaReclamo[];

  @OneToMany(() => Liquidacion, (row) => row.consorcio)
  liquidaciones?: Liquidacion[];

  @OneToMany(() => Novedad, (row) => row.consorcio)
  novedades?: Novedad[];

  @OneToMany(() => Proveedor, (row) => row.consorcio)
  proveedores?: Proveedor[];

  @OneToMany(() => Reclamo, (row) => row.consorcio)
  reclamos?: Reclamo[];

  @OneToMany(() => RubroGasto, (row) => row.consorcio)
  rubroGastos?: RubroGasto[];

  @OneToMany(() => Unidad, (row) => row.consorcio)
  unidades?: Unidad[];

  @OneToMany(() => Votacion, (row) => row.consorcio)
  votaciones?: Votacion[];
}
