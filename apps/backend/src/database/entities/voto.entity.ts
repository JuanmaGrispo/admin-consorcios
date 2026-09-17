// GENERADO por `pnpm back db:generate-entities` — no editar a mano.
// Refleja la tabla `voto` de la base.

import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { numericTransformer } from '../transformers';
import { OpcionVoto } from './opcion_voto.entity';
import { Unidad } from './unidad.entity';
import { Usuario } from './usuario.entity';
import { Votacion } from './votacion.entity';

@Index('uq_voto_unidad', ['votacionId', 'unidadId'], { unique: true })
@Entity('voto')
export class Voto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'votacion_id' })
  votacionId: string;

  @ManyToOne(() => Votacion, undefined, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'votacion_id' })
  votacion: Votacion;

  @Column({ type: 'uuid', name: 'unidad_id' })
  unidadId: string;

  @ManyToOne(() => Unidad, undefined, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'unidad_id' })
  unidad: Unidad;

  @Column({ type: 'uuid', name: 'opcion_id' })
  opcionId: string;

  @ManyToOne(() => OpcionVoto, undefined, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'opcion_id' })
  opcion: OpcionVoto;

  @Column({ type: 'uuid', name: 'emitido_por' })
  emitidoPorId: string;

  @ManyToOne(() => Usuario, undefined, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'emitido_por' })
  emitidoPor: Usuario;

  @Column({ type: 'numeric', name: 'coeficiente_aplicado', precision: 7, scale: 4, transformer: numericTransformer })
  coeficienteAplicado: number;

  @Column({ type: 'boolean', name: 'anticipado', default: false })
  anticipado: boolean;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;
}
