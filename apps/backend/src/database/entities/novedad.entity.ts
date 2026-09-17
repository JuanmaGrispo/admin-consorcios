// GENERADO por `pnpm back db:generate-entities` — no editar a mano.
// Refleja la tabla `novedad` de la base.

import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Consorcio } from './consorcio.entity';
import { NovedadAdjunto } from './novedad_adjunto.entity';
import { NovedadLectura } from './novedad_lectura.entity';
import { Usuario } from './usuario.entity';

@Entity('novedad')
export class Novedad {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'consorcio_id' })
  consorcioId: string;

  @ManyToOne(() => Consorcio, undefined, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'consorcio_id' })
  consorcio: Consorcio;

  @Column({ type: 'uuid', name: 'autor_id' })
  autorId: string;

  @ManyToOne(() => Usuario, undefined, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'autor_id' })
  autor: Usuario;

  @Column({ type: 'varchar', name: 'titulo', length: 150 })
  titulo: string;

  @Column({ type: 'text', name: 'cuerpo' })
  cuerpo: string;

  @Column({ type: 'boolean', name: 'fijada', default: false })
  fijada: boolean;

  @Column({ type: 'timestamptz', name: 'publicada_at', nullable: true })
  publicadaAt: Date | null;

  @Column({ type: 'boolean', name: 'activa', default: true })
  activa: boolean;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'updated_at', default: () => 'now()' })
  updatedAt: Date;

  @OneToMany(() => NovedadAdjunto, (row) => row.novedad)
  novedadAdjuntos?: NovedadAdjunto[];

  @OneToMany(() => NovedadLectura, (row) => row.novedad)
  novedadLecturas?: NovedadLectura[];
}
