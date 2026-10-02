import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Gasto, RubroGasto } from '../../database/entities';

@Injectable()
export class RubrosGastoRepository {
  constructor(
    @InjectRepository(RubroGasto)
    private readonly repo: Repository<RubroGasto>,
    @InjectRepository(Gasto)
    private readonly gastos: Repository<Gasto>,
  ) {}

  /** Con consorcio: los suyos más los compartidos. Sin consorcio: todos. */
  listar(consorcioId?: string): Promise<RubroGasto[]> {
    const qb = this.repo.createQueryBuilder('r').orderBy('r.nombre', 'ASC');
    if (consorcioId) {
      qb.where('r.consorcioId = :consorcioId', { consorcioId }).orWhere('r.consorcioId IS NULL');
    }
    return qb.getMany();
  }

  findById(id: string): Promise<RubroGasto | null> {
    return this.repo.findOneBy({ id });
  }

  /** Mismo criterio que categorías: choca con los que saldrían en la misma lista. */
  findPorNombre(nombre: string, consorcioId: string | null): Promise<RubroGasto | null> {
    const qb = this.repo
      .createQueryBuilder('r')
      .where('lower(r.nombre) = lower(:nombre)', { nombre });
    if (consorcioId) {
      qb.andWhere(
        new Brackets((sub) =>
          sub
            .where('r.consorcioId IS NULL')
            .orWhere('r.consorcioId = :consorcioId', { consorcioId }),
        ),
      );
    }
    return qb.getOne();
  }

  contarGastos(rubroId: string): Promise<number> {
    return this.gastos.countBy({ rubroId });
  }

  create(data: Partial<RubroGasto>): Promise<RubroGasto> {
    return this.repo.save(this.repo.create(data));
  }

  async update(rubro: RubroGasto, data: Partial<RubroGasto>): Promise<RubroGasto> {
    await this.repo.save({ ...rubro, ...data });
    return (await this.findById(rubro.id))!;
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete({ id });
  }
}
