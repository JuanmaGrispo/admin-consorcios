// GENERADO por `pnpm back db:generate-entities` — no editar a mano.
// Refleja la tabla `novedad_lectura` de la base.

import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Novedad } from './novedad.entity';
import { Usuario } from './usuario.entity';

@Index('uq_novedad_lectura', ['novedadId', 'usuarioId'], { unique: true })
@Entity('novedad_lectura')
export class NovedadLectura {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'novedad_id' })
  novedadId: string;

  @ManyToOne(() => Novedad, undefined, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'novedad_id' })
  novedad: Novedad;

  @Column({ type: 'uuid', name: 'usuario_id' })
  usuarioId: string;

  @ManyToOne(() => Usuario, undefined, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({ type: 'timestamptz', name: 'leida_at', default: () => 'now()' })
  leidaAt: Date;
}
