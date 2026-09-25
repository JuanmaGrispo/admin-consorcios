import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, IsNull, Like, Repository } from 'typeorm';
import {
  Boleta,
  BoletaDetalle,
  EstadoLiquidacion,
  Gasto,
  Liquidacion,
  Unidad,
  UnidadUsuario,
} from '../../database/entities';
import { ListarBoletasQuery } from './dto/listar-boletas.query';
import { ListarLiquidacionesQuery } from './dto/listar-liquidaciones.query';
import { PREFIJO_AJUSTE, type BoletaCalculada } from './prorrateo';

/** Las liquidaciones que ya salieron: sus boletas son deuda real y el vecino las ve. */
const EMITIDAS = [EstadoLiquidacion.EMITIDA, EstadoLiquidacion.CERRADA];

/** Mismo criterio de vigencia que usan reclamos y unidades. */
const VINCULO_VIGENTE = new Brackets((qb) =>
  qb.where('v.hasta IS NULL').orWhere('v.hasta >= CURRENT_DATE'),
);

@Injectable()
export class ExpensasRepository {
  constructor(
    @InjectRepository(Liquidacion)
    private readonly liquidaciones: Repository<Liquidacion>,
    @InjectRepository(Gasto)
    private readonly gastos: Repository<Gasto>,
    @InjectRepository(Boleta)
    private readonly boletas: Repository<Boleta>,
    @InjectRepository(Unidad)
    private readonly unidades: Repository<Unidad>,
    @InjectRepository(UnidadUsuario)
    private readonly vinculos: Repository<UnidadUsuario>,
    private readonly dataSource: DataSource,
  ) {}

  // ── Liquidaciones ──────────────────────────────────────────────────────────

  listar(query: ListarLiquidacionesQuery): Promise<Liquidacion[]> {
    const qb = this.liquidaciones
      .createQueryBuilder('l')
      .loadRelationCountAndMap('l.cantidadGastos', 'l.gastos')
      .loadRelationCountAndMap('l.cantidadBoletas', 'l.boletas')
      .orderBy('l.periodo', 'DESC');
    if (query.consorcioId) qb.andWhere('l.consorcioId = :c', { c: query.consorcioId });
    if (query.estado) qb.andWhere('l.estado = :e', { e: query.estado });
    return qb.getMany();
  }

  findById(id: string): Promise<Liquidacion | null> {
    return this.liquidaciones.findOneBy({ id });
  }

  /** La liquidación con sus gastos, para la pantalla de carga. */
  findConGastos(id: string): Promise<Liquidacion | null> {
    return this.liquidaciones.findOne({
      where: { id },
      relations: { gastos: { rubro: true, proveedor: true } },
      order: { gastos: { createdAt: 'ASC' } },
    });
  }

  findByPeriodo(consorcioId: string, periodo: string): Promise<Liquidacion | null> {
    return this.liquidaciones.findOneBy({ consorcioId, periodo });
  }

  /** El período más reciente ya emitido del consorcio, o null si no hay ninguno. */
  async ultimoPeriodoEmitido(consorcioId: string): Promise<string | null> {
    const fila = await this.liquidaciones
      .createQueryBuilder('l')
      .select('max(l.periodo)::text', 'periodo')
      .where('l.consorcioId = :consorcioId', { consorcioId })
      .andWhere('l.estado IN (:...emitidas)', { emitidas: EMITIDAS })
      .getRawOne<{ periodo: string | null }>();
    return fila?.periodo ?? null;
  }

  /** ¿Hay un período anterior que todavía no se emitió? */
  async hayPendienteAnterior(consorcioId: string, periodo: string): Promise<boolean> {
    const cantidad = await this.liquidaciones
      .createQueryBuilder('l')
      .where('l.consorcioId = :consorcioId', { consorcioId })
      .andWhere('l.periodo < :periodo', { periodo })
      .andWhere('l.estado NOT IN (:...emitidas)', { emitidas: EMITIDAS })
      .getCount();
    return cantidad > 0;
  }

  create(data: Partial<Liquidacion>): Promise<Liquidacion> {
    return this.liquidaciones.save(this.liquidaciones.create(data));
  }

  async update(id: string, data: Partial<Liquidacion>): Promise<void> {
    await this.liquidaciones.update({ id }, data);
  }

  /** Gastos y boletas se van con ella (FK en CASCADE). */
  async remove(id: string): Promise<void> {
    await this.liquidaciones.delete({ id });
  }

  // ── Gastos ─────────────────────────────────────────────────────────────────

  gastosDe(liquidacionId: string): Promise<Gasto[]> {
    return this.gastos.find({ where: { liquidacionId }, order: { createdAt: 'ASC' } });
  }

  findGasto(id: string): Promise<Gasto | null> {
    return this.gastos.findOne({ where: { id }, relations: { rubro: true, proveedor: true } });
  }

  async crearGasto(data: Partial<Gasto>): Promise<Gasto> {
    const creado = await this.gastos.save(this.gastos.create(data));
    return (await this.findGasto(creado.id))!;
  }

  async actualizarGasto(gasto: Gasto, data: Partial<Gasto>): Promise<Gasto> {
    // Sin las relaciones: si no, TypeORM toma el rubro cargado y pisa el rubroId nuevo.
    const { rubro: _r, proveedor: _p, liquidacion: _l, ...columnas } = gasto;
    await this.gastos.save({ ...columnas, ...data });
    return (await this.findGasto(gasto.id))!;
  }

  async borrarGasto(id: string): Promise<void> {
    await this.gastos.delete({ id });
  }

  /** `total_gastos` es un resumen: se recalcula desde los gastos, no se suma a mano. */
  async recalcularTotalGastos(liquidacionId: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE liquidacion
          SET total_gastos = (SELECT coalesce(sum(monto), 0) FROM gasto WHERE liquidacion_id = $1)
        WHERE id = $1`,
      [liquidacionId],
    );
  }

  // ── Insumos del prorrateo ──────────────────────────────────────────────────

  unidadesActivas(consorcioId: string): Promise<Unidad[]> {
    return this.unidades.find({
      where: { consorcioId, activa: true },
      order: { etiqueta: 'ASC' },
    });
  }

  /**
   * Lo que cada unidad dejó impago de su última boleta emitida anterior a
   * `periodo`: el total menos los pagos aprobados. Sólo la última, porque su
   * total ya arrastra la deuda de las anteriores.
   */
  async deudasAnteriores(
    consorcioId: string,
    periodo: string,
    unidadIds: string[],
  ): Promise<{ unidadId: string; saldo: number; fechaVencimiento: string }[]> {
    if (unidadIds.length === 0) return [];
    const filas: { unidadId: string; saldo: string; fechaVencimiento: string }[] =
      await this.dataSource.query(
        `SELECT DISTINCT ON (b.unidad_id)
                b.unidad_id AS "unidadId",
                (b.total - coalesce((SELECT sum(p.monto) FROM pago p
                                      WHERE p.boleta_id = b.id AND p.estado = 'APROBADO'), 0))::text AS saldo,
                l.fecha_vencimiento::text AS "fechaVencimiento"
           FROM boleta b
           JOIN liquidacion l ON l.id = b.liquidacion_id
          WHERE l.consorcio_id = $1
            AND l.periodo < $2
            AND l.estado IN ('EMITIDA', 'CERRADA')
            AND b.unidad_id = ANY($3::uuid[])
          ORDER BY b.unidad_id, l.periodo DESC`,
        [consorcioId, periodo, unidadIds],
      );
    return filas.map((f) => ({ ...f, saldo: Number(f.saldo) }));
  }

  /** Los ajustes manuales vigentes, para conservarlos al recalcular. */
  async ajustesDe(
    liquidacionId: string,
  ): Promise<Map<string, { monto: number; motivo: string | null }>> {
    const boletas = await this.boletas.find({
      where: { liquidacionId },
      select: { unidadId: true, ajusteManual: true, motivoAjuste: true },
    });
    return new Map(
      boletas
        .filter((b) => b.ajusteManual !== 0)
        .map((b) => [b.unidadId, { monto: b.ajusteManual, motivo: b.motivoAjuste }]),
    );
  }

  /** "Hoy" según la base, para medir los días de atraso con el mismo reloj que las fechas. */
  async hoy(): Promise<string> {
    const [fila] = await this.dataSource.query('SELECT CURRENT_DATE::text AS hoy');
    return (fila as { hoy: string }).hoy;
  }

  // ── Boletas ────────────────────────────────────────────────────────────────

  /**
   * Reemplaza las boletas de la liquidación por las recién calculadas y la deja
   * en `estado`. Todo o nada: una liquidación con la mitad de las boletas
   * viejas y la mitad nuevas sumaría cualquier cosa.
   */
  async reemplazarBoletas(
    liquidacionId: string,
    calculadas: BoletaCalculada[],
    estado: EstadoLiquidacion,
  ): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      // El detalle se va en cascada.
      await m.delete(Boleta, { liquidacionId });

      const guardadas = await m.save(
        calculadas.map(({ detalle: _d, ...datos }) => m.create(Boleta, { ...datos, liquidacionId })),
      );

      const detalles = calculadas.flatMap((b, i) =>
        b.detalle.map((linea) => m.create(BoletaDetalle, { ...linea, boletaId: guardadas[i].id })),
      );
      await m.save(detalles, { chunk: 500 });

      await m.update(Liquidacion, { id: liquidacionId }, { estado });
    });
  }

  listarBoletas(
    query: ListarBoletasQuery,
    filtro: { unidadIds?: string[]; soloEmitidas: boolean },
  ): Promise<Boleta[]> {
    const qb = this.boletas
      .createQueryBuilder('b')
      .innerJoinAndSelect('b.liquidacion', 'l')
      .innerJoinAndSelect('b.unidad', 'u')
      .orderBy('l.periodo', 'DESC')
      .addOrderBy('u.etiqueta', 'ASC');

    if (filtro.unidadIds) {
      if (filtro.unidadIds.length === 0) qb.andWhere('1 = 0');
      else qb.andWhere('b.unidadId IN (:...unidades)', { unidades: filtro.unidadIds });
    }
    // El vecino no ve previsualizaciones: todavía pueden cambiar.
    if (filtro.soloEmitidas) qb.andWhere('l.estado IN (:...emitidas)', { emitidas: EMITIDAS });
    if (query.liquidacionId) qb.andWhere('b.liquidacionId = :liq', { liq: query.liquidacionId });
    if (query.unidadId) qb.andWhere('b.unidadId = :uni', { uni: query.unidadId });
    if (query.estado) qb.andWhere('b.estado = :est', { est: query.estado });

    return qb.getMany();
  }

  /**
   * Con el detalle en orden de lectura: primero los gastos, después fondo,
   * saldo, mora y ajuste. Todas las líneas se insertan en la misma transacción
   * (mismo `created_at`), así que el orden se arma por tipo y concepto.
   */
  async findBoleta(id: string): Promise<Boleta | null> {
    const boleta = await this.boletas.findOne({
      where: { id },
      relations: { liquidacion: true, unidad: true, boletaDetalles: true },
    });
    boleta?.boletaDetalles?.sort(
      (a, b) =>
        Number(a.gastoId === null) - Number(b.gastoId === null) ||
        a.concepto.localeCompare(b.concepto),
    );
    return boleta;
  }

  /** Cambia el ajuste de una boleta y su línea en el detalle, juntos. */
  async aplicarAjuste(
    boletaId: string,
    datos: { ajusteManual: number; motivoAjuste: string | null; total: number },
    linea: { concepto: string; monto: number } | null,
  ): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      await m.update(Boleta, { id: boletaId }, datos);
      await m.delete(BoletaDetalle, {
        boletaId,
        gastoId: IsNull(),
        concepto: Like(`${PREFIJO_AJUSTE}%`),
      });
      if (linea) {
        await m.save(m.create(BoletaDetalle, { boletaId, gastoId: null, ...linea }));
      }
    });
  }

  // ── Vecinos ────────────────────────────────────────────────────────────────

  async unidadesDelUsuario(usuarioId: string): Promise<string[]> {
    const filas = await this.vinculos
      .createQueryBuilder('v')
      .select('v.unidadId', 'unidadId')
      .where('v.usuarioId = :usuarioId', { usuarioId })
      .andWhere(VINCULO_VIGENTE)
      .getRawMany<{ unidadId: string }>();
    return filas.map((f) => f.unidadId);
  }

  /** A quién avisarle por cada unidad: los vecinos vinculados hoy. */
  async vecinosPorUnidad(unidadIds: string[]): Promise<Map<string, string[]>> {
    const porUnidad = new Map<string, string[]>();
    if (unidadIds.length === 0) return porUnidad;

    const vinculos = await this.vinculos
      .createQueryBuilder('v')
      .where('v.unidadId IN (:...unidadIds)', { unidadIds })
      .andWhere(VINCULO_VIGENTE)
      .getMany();
    for (const v of vinculos) {
      porUnidad.set(v.unidadId, [...(porUnidad.get(v.unidadId) ?? []), v.usuarioId]);
    }
    return porUnidad;
  }
}
