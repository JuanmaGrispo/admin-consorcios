// GENERADO por `pnpm back db:generate-entities` — no editar a mano.
// Refleja la tabla `rubro_gasto` de la base.

import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { NaturalezaGasto } from './enums';
import { Consorcio } from './consorcio.entity';
import { Gasto } from './gasto.entity';

@Entity('rubro_gasto')
export class RubroGasto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'consorcio_id', nullable: true })
  consorcioId: string | null;

  @ManyToOne(() => Consorcio, undefined, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'consorcio_id' })
  consorcio?: Consorcio | null;

  @Column({ type: 'varchar', name: 'nombre', length: 80 })
  nombre: string;

  @Column({ type: 'varchar', name: 'icono', length: 40, nullable: true })
  icono: string | null;

  @Column({ type: 'enum', enum: NaturalezaGasto, enumName: 'naturaleza_gasto', name: 'naturaleza', default: 'ORDINARIO' })
  naturaleza: NaturalezaGasto;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'updated_at', default: () => 'now()' })
  updatedAt: Date;

  @OneToMany(() => Gasto, (row) => row.rubro)
  gastos?: Gasto[];
}
