// GENERADO por `pnpm back db:generate-entities` — no editar a mano.
// Refleja la tabla `categoria_reclamo` de la base.

import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Consorcio } from './consorcio.entity';
import { Reclamo } from './reclamo.entity';

@Entity('categoria_reclamo')
export class CategoriaReclamo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'consorcio_id', nullable: true })
  consorcioId: string | null;

  @ManyToOne(() => Consorcio, undefined, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'consorcio_id' })
  consorcio?: Consorcio | null;

  @Column({ type: 'varchar', name: 'nombre', length: 60 })
  nombre: string;

  @Column({ type: 'varchar', name: 'icono', length: 40, nullable: true })
  icono: string | null;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;

  @OneToMany(() => Reclamo, (row) => row.categoria)
  reclamos?: Reclamo[];
}
