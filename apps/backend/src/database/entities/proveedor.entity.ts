// GENERADO por `pnpm back db:generate-entities` — no editar a mano.
// Refleja la tabla `proveedor` de la base.

import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Consorcio } from './consorcio.entity';
import { Gasto } from './gasto.entity';
import { Reclamo } from './reclamo.entity';

@Entity('proveedor')
export class Proveedor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'consorcio_id', nullable: true })
  consorcioId: string | null;

  @ManyToOne(() => Consorcio, undefined, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'consorcio_id' })
  consorcio?: Consorcio | null;

  @Column({ type: 'varchar', name: 'razon_social', length: 150 })
  razonSocial: string;

  @Column({ type: 'varchar', name: 'cuit', length: 13, nullable: true })
  cuit: string | null;

  @Column({ type: 'varchar', name: 'rubro', length: 60, nullable: true })
  rubro: string | null;

  @Column({ type: 'varchar', name: 'email', length: 150, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', name: 'telefono', length: 30, nullable: true })
  telefono: string | null;

  @Column({ type: 'boolean', name: 'activo', default: true })
  activo: boolean;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'updated_at', default: () => 'now()' })
  updatedAt: Date;

  @OneToMany(() => Gasto, (row) => row.proveedor)
  gastos?: Gasto[];

  @OneToMany(() => Reclamo, (row) => row.proveedor)
  reclamos?: Reclamo[];
}
