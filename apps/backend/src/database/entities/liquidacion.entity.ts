// GENERADO por `pnpm back db:generate-entities` — no editar a mano.
// Refleja la tabla `liquidacion` de la base.

import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { CriterioProrrateo, EstadoLiquidacion } from './enums';
import { numericTransformer } from '../transformers';
import { Boleta } from './boleta.entity';
import { Consorcio } from './consorcio.entity';
import { Gasto } from './gasto.entity';
import { Usuario } from './usuario.entity';

@Index('uq_liquidacion_periodo', ['consorcioId', 'periodo'], { unique: true })
@Entity('liquidacion')
export class Liquidacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'consorcio_id' })
  consorcioId: string;

  @ManyToOne(() => Consorcio, undefined, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'consorcio_id' })
  consorcio: Consorcio;

  @Column({ type: 'date', name: 'periodo' })
  periodo: string;

  @Column({ type: 'enum', enum: EstadoLiquidacion, enumName: 'estado_liquidacion', name: 'estado', default: 'BORRADOR' })
  estado: EstadoLiquidacion;

  @Column({ type: 'enum', enum: CriterioProrrateo, enumName: 'criterio_prorrateo', name: 'criterio_prorrateo', default: 'COEFICIENTE' })
  criterioProrrateo: CriterioProrrateo;

  @Column({ type: 'date', name: 'fecha_vencimiento' })
  fechaVencimiento: string;

  @Column({ type: 'timestamptz', name: 'fecha_emision', nullable: true })
  fechaEmision: Date | null;

  @Column({ type: 'numeric', name: 'total_gastos', precision: 14, scale: 2, transformer: numericTransformer, default: 0 })
  totalGastos: number;

  @Column({ type: 'numeric', name: 'total_emitido', precision: 14, scale: 2, transformer: numericTransformer, default: 0 })
  totalEmitido: number;

  @Column({ type: 'uuid', name: 'creada_por' })
  creadaPorId: string;

  @ManyToOne(() => Usuario, undefined, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'creada_por' })
  creadaPor: Usuario;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'updated_at', default: () => 'now()' })
  updatedAt: Date;

  @OneToMany(() => Boleta, (row) => row.liquidacion)
  boletas?: Boleta[];

  @OneToMany(() => Gasto, (row) => row.liquidacion)
  gastos?: Gasto[];
}
