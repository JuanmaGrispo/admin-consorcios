import { Injectable, NotFoundException } from '@nestjs/common';
import { ConsorciosRepository } from './consorcios.repository';
import { CreateConsorcioDto } from './dto/create-consorcio.dto';
import { UpdateConsorcioDto } from './dto/update-consorcio.dto';
import { Consorcio } from './consorcios.entities';

@Injectable()
export class ConsorciosService {
  constructor(private readonly consorcios: ConsorciosRepository) {}

  findAll(): Promise<Consorcio[]> {
    return this.consorcios.findAll();
  }

  async findOne(id: string): Promise<Consorcio> {
    const consorcio = await this.consorcios.findById(id);
    if (!consorcio) throw new NotFoundException(`Consorcio ${id} no existe`);
    return consorcio;
  }

  create(dto: CreateConsorcioDto): Promise<Consorcio> {
    return this.consorcios.create(dto);
  }

  async update(id: string, dto: UpdateConsorcioDto): Promise<Consorcio> {
    const updated = await this.consorcios.update(id, dto);
    if (!updated) throw new NotFoundException(`Consorcio ${id} no existe`);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const removed = await this.consorcios.remove(id);
    if (!removed) throw new NotFoundException(`Consorcio ${id} no existe`);
  }
}
