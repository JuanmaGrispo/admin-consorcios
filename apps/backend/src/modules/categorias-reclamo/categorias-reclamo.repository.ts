import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { CategoriaReclamo, Reclamo } from '../../database/entities';

@Injectable()
export class CategoriasReclamoRepository {
  constructor(
    @InjectRepository(CategoriaReclamo)
    private readonly repo: Repository<CategoriaReclamo>,
    @InjectRepository(Reclamo)
    private readonly reclamos: Repository<Reclamo>,
  ) {}

  /** Con consorcio: las suyas más las compartidas. Sin consorcio: todas. */
  listar(consorcioId?: string, visibles?: string[]): Promise<CategoriaReclamo[]> {
    const qb = this.repo.createQueryBuilder('c').orderBy('c.nombre', 'ASC');
    if (consorcioId) {
      qb.andWhere(
        new Brackets((sub) =>
          sub
            .where('c.consorcioId = :consorcioId', { consorcioId })
            .orWhere('c.consorcioId IS NULL'),
        ),
      );
    }
    // Los compartidos (`consorcio_id` NULL) los ve cualquiera.
    if (visibles) {
      qb.andWhere(
        new Brackets((sub) => {
          sub.where('c.consorcioId IS NULL');
          if (visibles.length > 0) sub.orWhere('c.consorcioId IN (:...visibles)', { visibles });
        }),
      );
    }
    return qb.getMany();
  }

  findById(id: string): Promise<CategoriaReclamo | null> {
    return this.repo.findOneBy({ id });
  }

  /**
   * Busca por nombre, sin distinguir mayúsculas, entre las categorías que
   * aparecerían en la misma lista. Una compartida sale en todos los
   * consorcios, así que choca con cualquiera; una de consorcio, con las de ese
   * consorcio y las compartidas.
   */
  findPorNombre(nombre: string, consorcioId: string | null): Promise<CategoriaReclamo | null> {
    const qb = this.repo
      .createQueryBuilder('c')
      .where('lower(c.nombre) = lower(:nombre)', { nombre });
    if (consorcioId) {
      qb.andWhere(
        new Brackets((sub) =>
          sub
            .where('c.consorcioId IS NULL')
            .orWhere('c.consorcioId = :consorcioId', { consorcioId }),
        ),
      );
    }
    return qb.getOne();
  }

  contarReclamos(categoriaId: string): Promise<number> {
    return this.reclamos.countBy({ categoriaId });
  }

  create(data: Partial<CategoriaReclamo>): Promise<CategoriaReclamo> {
    return this.repo.save(this.repo.create(data));
  }

  async update(
    categoria: CategoriaReclamo,
    data: Partial<CategoriaReclamo>,
  ): Promise<CategoriaReclamo> {
    await this.repo.save({ ...categoria, ...data });
    return (await this.findById(categoria.id))!;
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete({ id });
  }
}
