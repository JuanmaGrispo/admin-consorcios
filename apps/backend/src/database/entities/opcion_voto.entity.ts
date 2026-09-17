// GENERADO por `pnpm back db:generate-entities` — no editar a mano.
// Refleja la tabla `opcion_voto` de la base.

import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Votacion } from './votacion.entity';
import { Voto } from './voto.entity';

@Entity('opcion_voto')
export class OpcionVoto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'votacion_id' })
  votacionId: string;

  @ManyToOne(() => Votacion, undefined, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'votacion_id' })
  votacion: Votacion;

  @Column({ type: 'varchar', name: 'etiqueta', length: 60 })
  etiqueta: string;

  @Column({ type: 'smallint', name: 'orden', default: 0 })
  orden: number;

  @Column({ type: 'boolean', name: 'es_fija', default: false })
  esFija: boolean;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;

  @OneToMany(() => Voto, (row) => row.opcion)
  votos?: Voto[];
}
