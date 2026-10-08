import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Not, Repository } from 'typeorm';
import { EstadoPago, MedioPago, Pago } from '../../database/entities';
import { ListarPagosQuery } from './dto/listar-pagos.query';

@Injectable()
export class PagosRepository {
  constructor(
    @InjectRepository(Pago)
    private readonly pagos: Repository<Pago>,
    private readonly dataSource: DataSource,
  ) {}

  /** El vecino ve los de sus unidades; el administrador, los de sus consorcios. */
  listar(
    query: ListarPagosQuery,
    alcance: { unidadIds?: string[]; consorcioIds?: string[] },
  ): Promise<Pago[]> {
    const { unidadIds, consorcioIds } = alcance;
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
    if (consorcioIds) {
      if (consorcioIds.length === 0) qb.andWhere('1 = 0');
      else qb.andWhere('u.consorcioId IN (:...consorcioIds)', { consorcioIds });
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

  /** El checkout de Mercado Pago que quedó abierto para esta boleta, si hay uno. */
  pendienteDeMercadoPago(boletaId: string): Promise<Pago | null> {
    return this.pagos.findOne({
      where: {
        boletaId,
        medio: MedioPago.MERCADO_PAGO,
        estado: EstadoPago.PENDIENTE,
        mpPreferenceId: Not(IsNull()),
      },
      order: { createdAt: 'DESC' },
    });
  }

  /** Lo cobrado de una boleta: sólo cuentan los pagos aprobados. */
  async aprobadoDe(boletaId: string): Promise<number> {
    const [fila] = await this.dataSource.query(
      `SELECT coalesce(sum(monto), 0)::float AS total
         FROM pago WHERE boleta_id = $1 AND estado = 'APROBADO'`,
      [boletaId],
    );
    return (fila as { total: number }).total;
  }

  crear(data: Partial<Pago>): Promise<Pago> {
    return this.pagos.save(this.pagos.create(data));
  }

  /** Actualiza sólo si el pago sigue en `estado`; null si otro lo movió antes. */
  async actualizarSiEstado(id: string, estado: EstadoPago, data: Partial<Pago>): Promise<Pago | null> {
    const { affected } = await this.pagos.update({ id, estado }, data);
    return affected ? this.findById(id) : null;
  }

  async actualizar(id: string, data: Partial<Pago>): Promise<Pago> {
    await this.pagos.update({ id }, data);
    return (await this.findById(id))!;
  }
}
