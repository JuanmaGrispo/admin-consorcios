import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Pago } from '../../database/entities';
import { ListarPagosQuery } from './dto/listar-pagos.query';

@Injectable()
export class PagosRepository {
  constructor(
    @InjectRepository(Pago)
    private readonly pagos: Repository<Pago>,
    private readonly dataSource: DataSource,
  ) {}

  /** `unidadIds` acota lo que ve un vecino; sin él, todo (administrador). */
  listar(query: ListarPagosQuery, unidadIds?: string[]): Promise<Pago[]> {
    const qb = this.pagos
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.boleta', 'b')
      .leftJoinAndSelect('b.liquidacion', 'l')
      .innerJoinAndSelect('p.unidad', 'u')
      .orderBy('p.createdAt', 'DESC');

    if (unidadIds) {
      if (unidadIds.length === 0) qb.andWhere('1 = 0');
      else qb.andWhere('p.unidadId IN (:...unidades)', { unidades: unidadIds });
    }
    if (query.boletaId) qb.andWhere('p.boletaId = :boleta', { boleta: query.boletaId });
    if (query.unidadId) qb.andWhere('p.unidadId = :unidad', { unidad: query.unidadId });
    if (query.estado) qb.andWhere('p.estado = :estado', { estado: query.estado });
    return qb.getMany();
  }

  findById(id: string): Promise<Pago | null> {
    return this.pagos.findOneBy({ id });
  }

  /** Con la unidad y la boleta: lo que hace falta para mostrarlo o imprimirlo. */
  findConRelaciones(id: string): Promise<Pago | null> {
    return this.pagos.findOne({
      where: { id },
      relations: { unidad: true, boleta: { liquidacion: true } },
    });
  }

  /**
   * El próximo correlativo de recibo. Sale de una secuencia de Postgres: dos
   * pagos aprobados a la vez —el webhook y un pago manual— no pueden llevarse
   * el mismo número.
   */
  async siguienteCorrelativoRecibo(): Promise<number> {
    const [fila] = await this.dataSource.query(
      `SELECT nextval('recibo_pago_numero')::int AS numero`,
    );
    return (fila as { numero: number }).numero;
  }

  crear(data: Partial<Pago>): Promise<Pago> {
    return this.pagos.save(this.pagos.create(data));
  }

  async actualizar(id: string, data: Partial<Pago>): Promise<Pago> {
    await this.pagos.update({ id }, data);
    return (await this.findById(id))!;
  }
}
