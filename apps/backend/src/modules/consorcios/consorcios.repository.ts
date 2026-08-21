import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Consorcio } from './consorcios.entities';

/**
 * Única puerta a la tabla `consorcios`. El service habla con esta clase,
 * nunca con TypeORM directo: si mañana cambia el ORM o aparece una query
 * compleja, el cambio queda contenido acá.
 */
@Injectable()
export class ConsorciosRepository {
  constructor(
    @InjectRepository(Consorcio)
    private readonly repo: Repository<Consorcio>,
  ) {}

  findAll(): Promise<Consorcio[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  findById(id: string): Promise<Consorcio | null> {
    return this.repo.findOneBy({ id });
  }

  create(data: Partial<Consorcio>): Promise<Consorcio> {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, data: Partial<Consorcio>): Promise<Consorcio | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    return this.repo.save({ ...existing, ...data });
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.repo.delete({ id });
    return (result.affected ?? 0) > 0;
  }
}
