// GENERADO por `pnpm back db:generate-entities` — no editar a mano.
// Refleja la tabla `notificacion` de la base.

import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TipoNotificacion } from './enums';
import { Usuario } from './usuario.entity';

@Entity('notificacion')
export class Notificacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'usuario_id' })
  usuarioId: string;

  @ManyToOne(() => Usuario, undefined, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({ type: 'varchar', name: 'titulo', length: 150 })
  titulo: string;

  @Column({ type: 'text', name: 'cuerpo', nullable: true })
  cuerpo: string | null;

  @Column({ type: 'enum', enum: TipoNotificacion, enumName: 'tipo_notificacion', name: 'tipo' })
  tipo: TipoNotificacion;

  @Column({ type: 'varchar', name: 'entidad_tipo', length: 40, nullable: true })
  entidadTipo: string | null;

  @Column({ type: 'uuid', name: 'entidad_id', nullable: true })
  entidadId: string | null;

  @Column({ type: 'timestamptz', name: 'leida_at', nullable: true })
  leidaAt: Date | null;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;
}
