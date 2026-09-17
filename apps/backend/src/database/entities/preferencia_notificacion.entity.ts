// GENERADO por `pnpm back db:generate-entities` — no editar a mano.
// Refleja la tabla `preferencia_notificacion` de la base.

import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { CanalNotificacion, CategoriaNotificacion } from './enums';
import { Usuario } from './usuario.entity';

@Index('uq_preferencia', ['usuarioId', 'canal', 'categoria'], { unique: true })
@Entity('preferencia_notificacion')
export class PreferenciaNotificacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'usuario_id' })
  usuarioId: string;

  @ManyToOne(() => Usuario, undefined, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({ type: 'enum', enum: CanalNotificacion, enumName: 'canal_notificacion', name: 'canal' })
  canal: CanalNotificacion;

  @Column({ type: 'enum', enum: CategoriaNotificacion, enumName: 'categoria_notificacion', name: 'categoria' })
  categoria: CategoriaNotificacion;

  @Column({ type: 'boolean', name: 'habilitado', default: true })
  habilitado: boolean;
}
