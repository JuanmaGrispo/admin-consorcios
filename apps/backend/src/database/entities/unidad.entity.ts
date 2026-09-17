// GENERADO por `pnpm back db:generate-entities` — no editar a mano.
// Refleja la tabla `unidad` de la base.

import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { TipoUnidad } from './enums';
import { numericTransformer } from '../transformers';
import { Asistencia } from './asistencia.entity';
import { Boleta } from './boleta.entity';
import { Consorcio } from './consorcio.entity';
import { Pago } from './pago.entity';
import { Reclamo } from './reclamo.entity';
import { Reserva } from './reserva.entity';
import { UnidadUsuario } from './unidad_usuario.entity';
import { Voto } from './voto.entity';

@Index('uq_unidad_etiqueta', ['consorcioId', 'etiqueta'], { unique: true })
@Entity('unidad')
export class Unidad {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'consorcio_id' })
  consorcioId: string;

  @ManyToOne(() => Consorcio, undefined, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'consorcio_id' })
  consorcio: Consorcio;

  @Column({ type: 'varchar', name: 'etiqueta', length: 20 })
  etiqueta: string;

  @Column({ type: 'varchar', name: 'piso', length: 5, nullable: true })
  piso: string | null;

  @Column({ type: 'varchar', name: 'departamento', length: 5, nullable: true })
  departamento: string | null;

  @Column({ type: 'enum', enum: TipoUnidad, enumName: 'tipo_unidad', name: 'tipo', default: 'DEPARTAMENTO' })
  tipo: TipoUnidad;

  @Column({ type: 'numeric', name: 'coeficiente', precision: 7, scale: 4, transformer: numericTransformer })
  coeficiente: number;

  @Column({ type: 'numeric', name: 'metros_cuadrados', precision: 8, scale: 2, transformer: numericTransformer, nullable: true })
  metrosCuadrados: number | null;

  @Column({ type: 'boolean', name: 'activa', default: true })
  activa: boolean;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'updated_at', default: () => 'now()' })
  updatedAt: Date;

  @OneToMany(() => Asistencia, (row) => row.apoderadoUnidad)
  asistencias?: Asistencia[];

  @OneToMany(() => Asistencia, (row) => row.unidad)
  asistenciasPorUnidad?: Asistencia[];

  @OneToMany(() => Boleta, (row) => row.unidad)
  boletas?: Boleta[];

  @OneToMany(() => Pago, (row) => row.unidad)
  pagos?: Pago[];

  @OneToMany(() => Reclamo, (row) => row.unidad)
  reclamos?: Reclamo[];

  @OneToMany(() => Reserva, (row) => row.unidad)
  reservas?: Reserva[];

  @OneToMany(() => UnidadUsuario, (row) => row.unidad)
  unidadUsuarios?: UnidadUsuario[];

  @OneToMany(() => Voto, (row) => row.unidad)
  votos?: Voto[];
}
