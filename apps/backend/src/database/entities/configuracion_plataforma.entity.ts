// GENERADO por `pnpm back db:generate-entities` — no editar a mano.
// Refleja la tabla `configuracion_plataforma` de la base.

import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Usuario } from './usuario.entity';

@Entity('configuracion_plataforma')
export class ConfiguracionPlataforma {
  @PrimaryColumn({ type: 'varchar', name: 'clave' })
  clave: string;

  @Column({ type: 'jsonb', name: 'valor' })
  valor: object;

  @Column({ type: 'timestamptz', name: 'actualizado_at', default: () => 'now()' })
  actualizadoAt: Date;

  @Column({ type: 'uuid', name: 'actualizado_por', nullable: true })
  actualizadoPorId: string | null;

  @ManyToOne(() => Usuario, undefined, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actualizado_por' })
  actualizadoPor?: Usuario | null;
}
