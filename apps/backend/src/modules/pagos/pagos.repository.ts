import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Not, Repository } from 'typeorm';
import { Boleta, Reserva, Consorcio, EstadoBoleta, EstadoPago, MedioPago, Pago } from '../../database/entities';
import { EventoDomus } from '../../core/mensajeria/eventos';
import { registrarEventos } from '../../core/mensajeria/outbox.repository';
import { ListarPagosQuery } from './dto/listar-pagos.query';
import { formatearNumeroRecibo } from './recibo';

export interface ContextoPago {
  pago: Pago; boleta: Boleta | null; reserva: Reserva | null; totalAprobado: number;
  hoy: string; vecinos: string[]; administradorId: string; primeraAprobacion: boolean;
}
export type EfectosPago = (contexto: ContextoPago) => { eventos: EventoDomus[]; estadoBoleta?: EstadoBoleta };

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

  /** El checkout de Mercado Pago que quedó abierto para esta boleta o seña, si hay uno. */
  pendienteDeMercadoPago(destino: { boletaId: string | null; reservaId: string | null }): Promise<Pago | null> {
    return this.pagos.findOne({
      where: {
        ...(destino.boletaId ? { boletaId: destino.boletaId } : { reservaId: destino.reservaId! }),
        medio: MedioPago.MERCADO_PAGO,
        estado: EstadoPago.PENDIENTE,
        mpPreferenceId: Not(IsNull()),
      },
      order: { createdAt: 'DESC' },
    });
  }

  preferenciaIncierta(destino: { boletaId: string | null; reservaId: string | null }): Promise<Pago | null> {
    return this.pagos.findOneBy({ ...(destino.boletaId ? { boletaId: destino.boletaId } : { reservaId: destino.reservaId! }),
      estado: EstadoPago.PENDIENTE, mpStatusDetail: 'preferencia_incierta' });
  }

  /** Lo cobrado de una boleta o de una seña: sólo cuentan los pagos aprobados. */
  async aprobadoDe(destino: { boletaId?: string; reservaId?: string }): Promise<number> {
    const columna = destino.boletaId ? 'boleta_id' : 'reserva_id';
    const [fila] = await this.dataSource.query(
      `SELECT coalesce(sum(monto), 0)::float AS total
         FROM pago WHERE ${columna} = $1 AND estado = 'APROBADO'`,
      [destino.boletaId ?? destino.reservaId],
    );
    return (fila as { total: number }).total;
  }

  async crear(data: Partial<Pago>, efectos?: EfectosPago): Promise<Pago> {
    return this.dataSource.transaction(async (m) => {
      await this.bloquearDestino(m, data);
      const pago = await m.save(m.create(Pago, data));
      await this.aplicarEfectos(m, pago, undefined, efectos);
      return pago;
    });
  }

  /** Actualiza sólo si el pago sigue en `estado`; null si otro lo movió antes. */
  async actualizarSiEstado(id: string, estado: EstadoPago, data: Partial<Pago>, efectos?: EfectosPago): Promise<Pago | null> {
    return this.dataSource.transaction(async (m) => {
      const pago = await m.findOne(Pago, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!pago || pago.estado !== estado) return null;
      await this.bloquearDestino(m, pago);
      const nuevo = await m.save(Pago, { ...pago, ...data });
      await this.aplicarEfectos(m, nuevo, estado, efectos);
      return nuevo;
    });
  }

  async actualizar(id: string, data: Partial<Pago>, efectos?: EfectosPago): Promise<Pago> {
    return this.dataSource.transaction(async (m) => {
      const pago = await m.findOneOrFail(Pago, { where: { id }, lock: { mode: 'pessimistic_write' } });
      await this.bloquearDestino(m, pago);
      const nuevo = await m.save(Pago, { ...pago, ...data });
      await this.aplicarEfectos(m, nuevo, pago.estado, efectos);
      return nuevo;
    });
  }

  private async bloquearDestino(m: EntityManager, pago: Partial<Pago>): Promise<void> {
    if (pago.boletaId) await m.query('SELECT id FROM boleta WHERE id=$1 FOR UPDATE', [pago.boletaId]);
    else if (pago.reservaId) await m.query('SELECT id FROM reserva WHERE id=$1 FOR UPDATE', [pago.reservaId]);
  }

  private async aplicarEfectos(m: EntityManager, pago: Pago, estadoAnterior: EstadoPago | undefined, efectos?: EfectosPago): Promise<void> {
    if (!efectos) return;
    if (pago.estado === EstadoPago.APROBADO && !pago.reciboNumero) {
      const [{ numero }] = await m.query(`SELECT nextval('recibo_pago_numero')::text AS numero`);
      pago.reciboNumero = formatearNumeroRecibo(Number(numero));
      await m.update(Pago, { id: pago.id }, { reciboNumero: pago.reciboNumero });
    }
    const boleta = pago.boletaId ? await m.findOneOrFail(Boleta, { where: { id: pago.boletaId }, relations: { liquidacion: true, unidad: true } }) : null;
    const reserva = pago.reservaId ? await m.findOneOrFail(Reserva, { where: { id: pago.reservaId }, relations: { amenity: true, unidad: true } }) : null;
    const consorcio = await m.findOneByOrFail(Consorcio, { id: boleta?.liquidacion.consorcioId ?? reserva!.amenity.consorcioId });
    const [{ total, hoy }] = await m.query(`SELECT coalesce(sum(monto),0)::float AS total, current_date::text AS hoy
      FROM pago WHERE ${pago.boletaId ? 'boleta_id' : 'reserva_id'}=$1 AND estado='APROBADO'`, [pago.boletaId ?? pago.reservaId]);
    const vecinos: { id: string }[] = await m.query(`SELECT DISTINCT u.id FROM usuario u JOIN unidad_usuario uu ON uu.usuario_id=u.id
      WHERE uu.unidad_id=$1 AND u.activo AND (uu.hasta IS NULL OR uu.hasta>current_date)`, [pago.unidadId]);
    const plan = efectos({ pago, boleta, reserva, totalAprobado: total, hoy, vecinos: vecinos.map((v) => v.id), administradorId: consorcio.administradorId,
      primeraAprobacion: pago.estado === EstadoPago.APROBADO && estadoAnterior !== EstadoPago.APROBADO });
    if (boleta && plan.estadoBoleta) await m.update(Boleta, { id: boleta.id }, { estado: plan.estadoBoleta });
    if (boleta && plan.estadoBoleta === EstadoBoleta.PAGADA) await m.query(`UPDATE boleta b SET estado='PAGADA',updated_at=now()
      FROM liquidacion l WHERE l.id=b.liquidacion_id AND b.unidad_id=$1 AND l.periodo<$2
      AND l.estado IN ('EMITIDA','CERRADA') AND b.estado<>'PAGADA'`, [boleta.unidadId, boleta.liquidacion.periodo]);
    await registrarEventos(m, plan.eventos);
  }
}
