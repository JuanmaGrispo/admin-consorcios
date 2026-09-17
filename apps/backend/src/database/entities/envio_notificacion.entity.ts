// GENERADO por `pnpm back db:generate-entities` — no editar a mano.
// Refleja la tabla `envio_notificacion` de la base.

import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { CanalNotificacion, EstadoEnvio } from './enums';

@Entity('envio_notificacion')
export class EnvioNotificacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: CanalNotificacion, enumName: 'canal_notificacion', name: 'canal' })
  canal: CanalNotificacion;

  @Column({ type: 'varchar', name: 'destinatario', length: 150 })
  destinatario: string;

  @Column({ type: 'varchar', name: 'plantilla', length: 60 })
  plantilla: string;

  @Column({ type: 'jsonb', name: 'payload', default: '{}' })
  payload: Record<string, unknown>;

  @Column({ type: 'enum', enum: EstadoEnvio, enumName: 'estado_envio', name: 'estado', default: 'PENDIENTE' })
  estado: EstadoEnvio;

  @Column({ type: 'smallint', name: 'intentos', default: 0 })
  intentos: number;

  @Column({ type: 'text', name: 'ultimo_error', nullable: true })
  ultimoError: string | null;

  @Column({ type: 'varchar', name: 'entidad_tipo', length: 40, nullable: true })
  entidadTipo: string | null;

  @Column({ type: 'uuid', name: 'entidad_id', nullable: true })
  entidadId: string | null;

  @Column({ type: 'timestamptz', name: 'enviado_at', nullable: true })
  enviadoAt: Date | null;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'updated_at', default: () => 'now()' })
  updatedAt: Date;
}
