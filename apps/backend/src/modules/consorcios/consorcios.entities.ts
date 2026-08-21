import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';

@Entity('consorcios')
export class Consorcio extends BaseEntity {
  @Column()
  nombre: string;

  @Column()
  direccion: string;

  @Column({ type: 'int', default: 0 })
  unidades: number;
}
