// GENERADO por `pnpm back db:generate-entities` — no editar a mano.
// Refleja la tabla `usuario` de la base.

import { Column, Entity, Index, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { RolUsuario } from './enums';
import { AmenityBloqueo } from './amenity_bloqueo.entity';
import { Asamblea } from './asamblea.entity';
import { Asistencia } from './asistencia.entity';
import { Consorcio } from './consorcio.entity';
import { Liquidacion } from './liquidacion.entity';
import { Notificacion } from './notificacion.entity';
import { Novedad } from './novedad.entity';
import { NovedadLectura } from './novedad_lectura.entity';
import { Pago } from './pago.entity';
import { PreferenciaNotificacion } from './preferencia_notificacion.entity';
import { Reclamo } from './reclamo.entity';
import { ReclamoEvento } from './reclamo_evento.entity';
import { Reserva } from './reserva.entity';
import { UnidadUsuario } from './unidad_usuario.entity';
import { Voto } from './voto.entity';

@Index('usuario_email_key', ['email'], { unique: true })
@Entity('usuario')
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', name: 'nombre', length: 80 })
  nombre: string;

  @Column({ type: 'varchar', name: 'apellido', length: 80 })
  apellido: string;

  @Column({ type: 'varchar', name: 'email', length: 150 })
  email: string;

  @Column({ type: 'varchar', name: 'password_hash', length: 255 })
  passwordHash: string;

  @Column({ type: 'varchar', name: 'dni', length: 20, nullable: true })
  dni: string | null;

  @Column({ type: 'varchar', name: 'telefono', length: 30, nullable: true })
  telefono: string | null;

  @Column({ type: 'enum', enum: RolUsuario, enumName: 'rol_usuario', name: 'rol', default: 'VECINO' })
  rol: RolUsuario;

  @Column({ type: 'text', name: 'avatar_url', nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'boolean', name: 'activo', default: true })
  activo: boolean;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'updated_at', default: () => 'now()' })
  updatedAt: Date;

  @OneToMany(() => AmenityBloqueo, (row) => row.creadoPor)
  amenityBloqueos?: AmenityBloqueo[];

  @OneToMany(() => Asamblea, (row) => row.creadaPor)
  asambleas?: Asamblea[];

  @OneToMany(() => Asistencia, (row) => row.confirmadaPor)
  asistencias?: Asistencia[];

  @OneToMany(() => Consorcio, (row) => row.administrador)
  consorcios?: Consorcio[];

  @OneToMany(() => Liquidacion, (row) => row.creadaPor)
  liquidaciones?: Liquidacion[];

  @OneToMany(() => Notificacion, (row) => row.usuario)
  notificaciones?: Notificacion[];

  @OneToMany(() => Novedad, (row) => row.autor)
  novedades?: Novedad[];

  @OneToMany(() => NovedadLectura, (row) => row.usuario)
  novedadLecturas?: NovedadLectura[];

  @OneToMany(() => Pago, (row) => row.registradoPor)
  pagos?: Pago[];

  @OneToMany(() => PreferenciaNotificacion, (row) => row.usuario)
  preferenciaNotificaciones?: PreferenciaNotificacion[];

  @OneToMany(() => Reclamo, (row) => row.creadoPor)
  reclamos?: Reclamo[];

  @OneToMany(() => ReclamoEvento, (row) => row.autor)
  reclamoEventos?: ReclamoEvento[];

  @OneToMany(() => Reserva, (row) => row.resueltaPor)
  reservas?: Reserva[];

  @OneToMany(() => Reserva, (row) => row.solicitadaPor)
  reservasPorSolicitadaPor?: Reserva[];

  @OneToMany(() => UnidadUsuario, (row) => row.usuario)
  unidadUsuarios?: UnidadUsuario[];

  @OneToMany(() => Voto, (row) => row.emitidoPor)
  votos?: Voto[];
}
