import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, IsNull, Like, Repository, SelectQueryBuilder } from 'typeorm';
import {
  Boleta,
  BoletaDetalle,
  EstadoBoleta,
  EstadoLiquidacion,
  Gasto,
  Liquidacion,
  MedioPago,
  Unidad,
  UnidadUsuario,
  Votacion,
} from '../../database/entities';
import { ListarLiquidacionesQuery } from './dto/listar-liquidaciones.query';
import { PREFIJO_AJUSTE, type BoletaCalculada } from './prorrateo';

/** Las liquidaciones que ya salieron: sus boletas son deuda real y el vecino las ve. */
const EMITIDAS = [EstadoLiquidacion.EMITIDA, EstadoLiquidacion.CERRADA];

/**
 * Qué boletas entran en una consulta de cobranzas. Lo arma el service a
 * partir de los filtros de la pantalla y de quién está mirando; el repository
 * sólo lo traduce a SQL.
 */
export interface AlcanceBoletas {
  liquidacionId?: string;
  consorcioId?: string;
  unidadId?: string;
  /** AAAA-MM. */
  periodo?: string;
  estado?: EstadoBoleta;
  /** Los estados de una solapa (`pendientes` son dos). */
  estados?: EstadoBoleta[];
  /** Sólo las que todavía deben algo: para los recordatorios. */
  conSaldo?: boolean;
  buscar?: string;
  /** Acota a las unidades del vecino. */
  unidadIds?: string[];
  /** Acota a los consorcios del administrador; sin él, todos (superadmin). */
  consorcioIds?: string[];
  soloEmitidas: boolean;
}

export interface ResumenCobranzas {
  emitido: number;
  cobrado: number;
  saldoPendiente: number;
  interesesAcumulados: number;
  conteos: { todos: number; pagados: number; pendientes: number; vencidos: number };
}

export interface PagoDeBoleta {
  pagado: number;
  medio: MedioPago;
}

/**
 * Lo pagado de la boleta de la fila actual, como subconsulta escalar. Es el
 * mismo criterio que `pagadoDe`: sólo los pagos APROBADO cuentan como cobrado.
 */
const PAGADO_DE_LA_BOLETA = `(SELECT coalesce(sum(p.monto), 0)
                                FROM pago p
                               WHERE p.boleta_id = b.id AND p.estado = 'APROBADO')`;

/** Lo que se muestra de un gasto: rubro, proveedor y de dónde salió. */
const RELACIONES_GASTO = { rubro: true, proveedor: true, reclamo: true, votacion: true } as const;

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
    @InjectRepository(Votacion)
    private readonly votaciones: Repository<Votacion>,
    private readonly dataSource: DataSource,
  ) {}

  // ── Liquidaciones ──────────────────────────────────────────────────────────

  listar(query: ListarLiquidacionesQuery, consorcioIds?: string[]): Promise<Liquidacion[]> {
    const qb = this.liquidaciones
      .createQueryBuilder('l')
      .loadRelationCountAndMap('l.cantidadGastos', 'l.gastos')
      .loadRelationCountAndMap('l.cantidadBoletas', 'l.boletas')
      .orderBy('l.periodo', 'DESC');
    if (query.consorcioId) qb.andWhere('l.consorcioId = :c', { c: query.consorcioId });
    if (consorcioIds) {
      if (consorcioIds.length === 0) qb.andWhere('1 = 0');
      else qb.andWhere('l.consorcioId IN (:...consorcioIds)', { consorcioIds });
    }
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
      relations: { gastos: RELACIONES_GASTO },
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
    return this.gastos.findOne({ where: { id }, relations: RELACIONES_GASTO });
  }

  async crearGasto(data: Partial<Gasto>): Promise<Gasto> {
    const creado = await this.gastos.save(this.gastos.create(data));
    return (await this.findGasto(creado.id))!;
  }

  async actualizarGasto(gasto: Gasto, data: Partial<Gasto>): Promise<Gasto> {
    // Sin las relaciones: si no, TypeORM toma el rubro cargado y pisa el rubroId nuevo.
    const {
      rubro: _r,
      proveedor: _p,
      liquidacion: _l,
      reclamo: _rc,
      votacion: _v,
      ...columnas
    } = gasto;
    await this.gastos.save({ ...columnas, ...data });
    return (await this.findGasto(gasto.id))!;
  }

  async borrarGasto(id: string): Promise<void> {
    await this.gastos.delete({ id });
  }

  findVotacion(id: string): Promise<Votacion | null> {
    return this.votaciones.findOneBy({ id });
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

  /**
   * Las boletas del alcance, paginadas. La grilla de cobranzas también pide
   * el total para la paginación, así que vuelven las dos cosas.
   */
  async listarBoletas(
    alcance: AlcanceBoletas,
    pagina: { pagina: number; limite: number },
  ): Promise<{ items: Boleta[]; total: number }> {
    const qb = this.boletasDelAlcance(alcance)
      .innerJoinAndSelect('b.liquidacion', 'l')
      .innerJoinAndSelect('b.unidad', 'u')
      .orderBy('l.periodo', 'DESC')
      .addOrderBy('u.etiqueta', 'ASC')
      .skip((pagina.pagina - 1) * pagina.limite)
      .take(pagina.limite);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  /**
   * Todas las boletas del alcance, sin paginar: la exportación y los
   * recordatorios trabajan sobre el conjunto completo, no sobre la página que
   * se está mirando. Con tope, porque "todas" de un consorcio grande y varios
   * años sigue teniendo que entrar en memoria.
   */
  listarBoletasCompletas(alcance: AlcanceBoletas, tope: number): Promise<Boleta[]> {
    return this.boletasDelAlcance(alcance)
      .innerJoinAndSelect('b.liquidacion', 'l')
      .innerJoinAndSelect('b.unidad', 'u')
      .orderBy('l.periodo', 'DESC')
      .addOrderBy('u.etiqueta', 'ASC')
      .take(tope)
      .getMany();
  }

  /**
   * Los totales de la cabecera de cobranzas, calculados en la base sobre el
   * mismo alcance que la grilla: si no, los KPIs dirían una cosa y las filas
   * de abajo, otra.
   */
  async resumenCobranzas(alcance: AlcanceBoletas): Promise<ResumenCobranzas> {
    const fila = await this.boletasDelAlcance(alcance)
      .select('coalesce(sum(b.total), 0)::text', 'emitido')
      .addSelect(`coalesce(sum(${PAGADO_DE_LA_BOLETA}), 0)::text`, 'cobrado')
      .addSelect(
        `coalesce(sum(greatest(b.total - ${PAGADO_DE_LA_BOLETA}, 0)), 0)::text`,
        'saldoPendiente',
      )
      .addSelect('coalesce(sum(b.intereses_mora), 0)::text', 'interesesAcumulados')
      .addSelect('count(*)::int', 'todos')
      .addSelect(`count(*) FILTER (WHERE b.estado = 'PAGADA')::int`, 'pagados')
      .addSelect(`count(*) FILTER (WHERE b.estado IN ('PENDIENTE', 'PARCIAL'))::int`, 'pendientes')
      .addSelect(`count(*) FILTER (WHERE b.estado = 'VENCIDA')::int`, 'vencidos')
      .getRawOne<Record<string, string | number>>();

    return {
      emitido: Number(fila?.emitido ?? 0),
      cobrado: Number(fila?.cobrado ?? 0),
      saldoPendiente: Number(fila?.saldoPendiente ?? 0),
      interesesAcumulados: Number(fila?.interesesAcumulados ?? 0),
      conteos: {
        todos: Number(fila?.todos ?? 0),
        pagados: Number(fila?.pagados ?? 0),
        pendientes: Number(fila?.pendientes ?? 0),
        vencidos: Number(fila?.vencidos ?? 0),
      },
    };
  }

  /**
   * Lo pagado y con qué medio, por boleta. En una sola consulta para toda la
   * página: una por fila serían 20 idas a la base para pintar una grilla.
   */
  async pagosPorBoleta(boletaIds: string[]): Promise<Map<string, PagoDeBoleta>> {
    const porBoleta = new Map<string, PagoDeBoleta>();
    if (boletaIds.length === 0) return porBoleta;

    const filas: { boletaId: string; pagado: string; medio: MedioPago }[] =
      await this.dataSource.query(
        `SELECT boleta_id AS "boletaId",
                sum(monto)::text AS pagado,
                -- El medio del último pago: es el que la grilla muestra.
                (array_agg(medio ORDER BY coalesce(fecha_pago, created_at) DESC))[1] AS medio
           FROM pago
          WHERE estado = 'APROBADO'
            AND boleta_id = ANY($1::uuid[])
          GROUP BY boleta_id`,
        [boletaIds],
      );

    for (const f of filas) {
      porBoleta.set(f.boletaId, { pagado: Number(f.pagado), medio: f.medio });
    }
    return porBoleta;
  }

  /** Los vínculos vigentes de varias unidades, con el vecino de cada uno. */
  async vinculosVigentes(unidadIds: string[]): Promise<Map<string, UnidadUsuario[]>> {
    const porUnidad = new Map<string, UnidadUsuario[]>();
    if (unidadIds.length === 0) return porUnidad;

    const vinculos = await this.vinculos
      .createQueryBuilder('v')
      .innerJoinAndSelect('v.usuario', 'usuario')
      .where('v.unidadId IN (:...unidadIds)', { unidadIds })
      .andWhere(VINCULO_VIGENTE)
      // El titular primero: es a quien elige la grilla cuando hay varios.
      .orderBy('v.esTitular', 'DESC')
      .addOrderBy('v.desde', 'ASC')
      .getMany();

    for (const v of vinculos) {
      porUnidad.set(v.unidadId, [...(porUnidad.get(v.unidadId) ?? []), v]);
    }
    return porUnidad;
  }

  /**
   * El query builder con el alcance ya aplicado. Lo comparten la grilla, el
   * resumen, la exportación y los recordatorios: un solo lugar donde decidir
   * qué boletas entran.
   */
  private boletasDelAlcance(alcance: AlcanceBoletas): SelectQueryBuilder<Boleta> {
    const qb = this.boletas.createQueryBuilder('b');

    if (alcance.unidadIds) {
      // `IN ()` es un error de sintaxis en Postgres: sin unidades no ve nada.
      if (alcance.unidadIds.length === 0) qb.andWhere('1 = 0');
      else qb.andWhere('b.unidadId IN (:...unidades)', { unidades: alcance.unidadIds });
    }
    if (alcance.consorcioIds) {
      if (alcance.consorcioIds.length === 0) qb.andWhere('1 = 0');
      else {
        qb.andWhere(
          `b.liquidacionId IN (SELECT id FROM liquidacion WHERE consorcio_id IN (:...consorcioIds))`,
          { consorcioIds: alcance.consorcioIds },
        );
      }
    }
    // El vecino no ve previsualizaciones: todavía pueden cambiar.
    if (alcance.soloEmitidas) {
      qb.andWhere(
        `b.liquidacionId IN (SELECT id FROM liquidacion WHERE estado IN (:...emitidas))`,
        { emitidas: EMITIDAS },
      );
    }
    if (alcance.liquidacionId) qb.andWhere('b.liquidacionId = :liq', { liq: alcance.liquidacionId });
    if (alcance.unidadId) qb.andWhere('b.unidadId = :uni', { uni: alcance.unidadId });
    if (alcance.estado) qb.andWhere('b.estado = :est', { est: alcance.estado });
    if (alcance.estados?.length) {
      qb.andWhere('b.estado IN (:...estados)', { estados: alcance.estados });
    }
    if (alcance.conSaldo) qb.andWhere(`b.total > ${PAGADO_DE_LA_BOLETA}`);

    if (alcance.consorcioId || alcance.periodo) {
      const condiciones = ['ls.id = b.liquidacion_id'];
      if (alcance.consorcioId) {
        condiciones.push('ls.consorcio_id = :cons');
        qb.setParameter('cons', alcance.consorcioId);
      }
      // `periodo` se guarda como el primer día del mes: se compara el mes.
      if (alcance.periodo) {
        condiciones.push(`to_char(ls.periodo, 'YYYY-MM') = :per`);
        qb.setParameter('per', alcance.periodo);
      }
      qb.andWhere(`EXISTS (SELECT 1 FROM liquidacion ls WHERE ${condiciones.join(' AND ')})`);
    }

    if (alcance.buscar) {
      // Por etiqueta de la unidad o por el nombre de cualquiera de sus vecinos
      // vigentes: en la grilla el administrador busca "Pereyra", no un uuid.
      qb.andWhere(
        new Brackets((sub) =>
          sub
            .where(
              `b.unidadId IN (SELECT id FROM unidad WHERE etiqueta ILIKE :q)`,
            )
            .orWhere(
              `EXISTS (SELECT 1 FROM unidad_usuario vu
                         JOIN usuario us ON us.id = vu.usuario_id
                        WHERE vu.unidad_id = b.unidad_id
                          AND (vu.hasta IS NULL OR vu.hasta >= CURRENT_DATE)
                          AND (us.nombre || ' ' || us.apellido) ILIKE :q)`,
            ),
        ),
      ).setParameter('q', `%${alcance.buscar}%`);
    }

    return qb;
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

  // ── Estado de las boletas ──────────────────────────────────────────────────

  /**
   * Pasa a VENCIDA las boletas emitidas con saldo cuyo vencimiento ya pasó.
   * Corre antes de cada lectura de boletas: así no hace falta un cron.
   */
  async marcarVencidas(): Promise<void> {
    await this.dataSource.query(
      `UPDATE boleta b
          SET estado = 'VENCIDA', updated_at = now()
         FROM liquidacion l
        WHERE l.id = b.liquidacion_id
          AND l.estado IN ('EMITIDA', 'CERRADA')
          AND b.estado IN ('PENDIENTE', 'PARCIAL')
          AND l.fecha_vencimiento < CURRENT_DATE`,
    );
  }

  async contarVencidasDeUnidad(unidadId: string): Promise<number> {
    return this.boletas.countBy({ unidadId, estado: EstadoBoleta.VENCIDA });
  }

  /** Suma de los pagos APROBADO de la boleta: el mismo criterio que la deuda. */
  async pagadoDe(boletaId: string): Promise<number> {
    const [fila] = await this.dataSource.query(
      `SELECT coalesce(sum(monto), 0)::text AS pagado
         FROM pago WHERE boleta_id = $1 AND estado = 'APROBADO'`,
      [boletaId],
    );
    return Number((fila as { pagado: string }).pagado);
  }

  /** La boleta emitida más reciente de la unidad: la única que se paga. */
  async ultimaBoletaEmitida(unidadId: string): Promise<string | null> {
    const fila = await this.boletas
      .createQueryBuilder('b')
      .innerJoin('b.liquidacion', 'l')
      .select('b.id', 'id')
      .where('b.unidadId = :unidadId', { unidadId })
      .andWhere('l.estado IN (:...emitidas)', { emitidas: EMITIDAS })
      .orderBy('l.periodo', 'DESC')
      .limit(1)
      .getRawOne<{ id: string }>();
    return fila?.id ?? null;
  }

  async actualizarEstado(boletaId: string, estado: EstadoBoleta): Promise<void> {
    await this.boletas.update({ id: boletaId }, { estado });
  }

  /**
   * Las boletas anteriores de la unidad que quedaron impagas: su deuda viajó
   * como saldo anterior a la última, así que pagar esa las salda también.
   */
  async saldarAnteriores(unidadId: string, periodo: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE boleta b
          SET estado = 'PAGADA', updated_at = now()
         FROM liquidacion l
        WHERE l.id = b.liquidacion_id
          AND b.unidad_id = $1
          AND l.periodo < $2
          AND l.estado IN ('EMITIDA', 'CERRADA')
          AND b.estado <> 'PAGADA'`,
      [unidadId, periodo],
    );
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
