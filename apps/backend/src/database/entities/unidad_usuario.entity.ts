// GENERADO por `pnpm back db:generate-entities` — no editar a mano.
// Refleja la tabla `unidad_usuario` de la base.

import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { VinculoUnidad } from './enums';
import { Unidad } from './unidad.entity';
import { Usuario } from './usuario.entity';

@Entity('unidad_usuario')
export class UnidadUsuario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'unidad_id' })
  unidadId: string;

  @ManyToOne(() => Unidad, undefined, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unidad_id' })
  unidad: Unidad;

  @Column({ type: 'uuid', name: 'usuario_id' })
  usuarioId: string;

  @ManyToOne(() => Usuario, undefined, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({ type: 'enum', enum: VinculoUnidad, enumName: 'vinculo_unidad', name: 'vinculo' })
  vinculo: VinculoUnidad;

  @Column({ type: 'boolean', name: 'es_titular', default: false })
  esTitular: boolean;

  @Column({ type: 'date', name: 'desde', default: () => 'CURRENT_DATE' })
  desde: string;

  @Column({ type: 'date', name: 'hasta', nullable: true })
  hasta: string | null;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'updated_at', default: () => 'now()' })
  updatedAt: Date;
}
