import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Consorcio } from '../../database/entities';

/**
 * Única puerta a la tabla `consorcio`. El service habla con esta clase,
 * nunca con TypeORM directo: si mañana cambia el ORM o aparece una query
 * compleja, el cambio queda contenido acá.
 */
@Injectable()
export class ConsorciosRepository {
  constructor(
    @InjectRepository(Consorcio)
    private readonly repo: Repository<Consorcio>,
  ) {}

  /** Trae el administrador y cuántas unidades tiene cada consorcio. */
  findAll(): Promise<Consorcio[]> {
    return this.repo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.administrador', 'a')
      .loadRelationCountAndMap('c.cantidadUnidades', 'c.unidades')
      .orderBy('c.createdAt', 'DESC')
      .getMany();
  }

  findById(id: string): Promise<Consorcio | null> {
    return this.repo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.administrador', 'a')
      .loadRelationCountAndMap('c.cantidadUnidades', 'c.unidades')
      .where('c.id = :id', { id })
      .getOne();
  }

  create(data: Partial<Consorcio>): Promise<Consorcio> {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, data: Partial<Consorcio>): Promise<Consorcio | null> {
    const existing = await this.repo.findOneBy({ id });
    if (!existing) return null;
    await this.repo.save({ ...existing, ...data });
    return this.findById(id);
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.repo.delete({ id });
    return (result.affected ?? 0) > 0;
  }
}
