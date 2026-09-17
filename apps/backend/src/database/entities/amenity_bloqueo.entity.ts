// GENERADO por `pnpm back db:generate-entities` — no editar a mano.
// Refleja la tabla `amenity_bloqueo` de la base.

import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Amenity } from './amenity.entity';
import { Usuario } from './usuario.entity';

@Entity('amenity_bloqueo')
export class AmenityBloqueo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'amenity_id' })
  amenityId: string;

  @ManyToOne(() => Amenity, undefined, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'amenity_id' })
  amenity: Amenity;

  @Column({ type: 'uuid', name: 'creado_por' })
  creadoPorId: string;

  @ManyToOne(() => Usuario, undefined, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'creado_por' })
  creadoPor: Usuario;

  @Column({ type: 'timestamptz', name: 'desde' })
  desde: Date;

  @Column({ type: 'timestamptz', name: 'hasta' })
  hasta: Date;

  @Column({ type: 'varchar', name: 'motivo', length: 120, nullable: true })
  motivo: string | null;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;
}
