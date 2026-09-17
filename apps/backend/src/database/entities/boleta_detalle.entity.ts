// GENERADO por `pnpm back db:generate-entities` — no editar a mano.
// Refleja la tabla `boleta_detalle` de la base.

import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { numericTransformer } from '../transformers';
import { Boleta } from './boleta.entity';
import { Gasto } from './gasto.entity';

@Entity('boleta_detalle')
export class BoletaDetalle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'boleta_id' })
  boletaId: string;

  @ManyToOne(() => Boleta, undefined, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'boleta_id' })
  boleta: Boleta;

  @Column({ type: 'uuid', name: 'gasto_id', nullable: true })
  gastoId: string | null;

  @ManyToOne(() => Gasto, undefined, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'gasto_id' })
  gasto?: Gasto | null;

  @Column({ type: 'varchar', name: 'concepto', length: 120 })
  concepto: string;

  @Column({ type: 'numeric', name: 'monto', precision: 14, scale: 2, transformer: numericTransformer })
  monto: number;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;
}
