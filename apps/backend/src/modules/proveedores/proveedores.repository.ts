import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Proveedor } from '../../database/entities';
import { ListarProveedoresQuery } from './dto/listar-proveedores.query';

@Injectable()
export class ProveedoresRepository {
  constructor(
    @InjectRepository(Proveedor)
    private readonly repo: Repository<Proveedor>,
  ) {}

  listar(query: ListarProveedoresQuery): Promise<Proveedor[]> {
    const qb = this.repo.createQueryBuilder('p').orderBy('p.razonSocial', 'ASC');

    // Filtrar por consorcio incluye los compartidos (`consorcio_id` NULL):
    // también son opciones válidas para ese edificio.
    if (query.consorcioId) {
      qb.andWhere(
        new Brackets((sub) =>
          sub
            .where('p.consorcioId = :consorcioId', { consorcioId: query.consorcioId })
            .orWhere('p.consorcioId IS NULL'),
        ),
      );
    }
    if (!query.incluirInactivos) qb.andWhere('p.activo = true');
    if (query.buscar) {
      qb.andWhere(
        new Brackets((sub) =>
          sub
            .where('p.razonSocial ILIKE :q', { q: `%${query.buscar}%` })
            .orWhere('p.rubro ILIKE :q', { q: `%${query.buscar}%` }),
        ),
      );
    }

    return qb.getMany();
  }

  findById(id: string): Promise<Proveedor | null> {
    return this.repo.findOneBy({ id });
  }

  create(data: Partial<Proveedor>): Promise<Proveedor> {
    return this.repo.save(this.repo.create(data));
  }

  async update(proveedor: Proveedor, data: Partial<Proveedor>): Promise<Proveedor> {
    await this.repo.save({ ...proveedor, ...data });
    return (await this.findById(proveedor.id))!;
  }
}
