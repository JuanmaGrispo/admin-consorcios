import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Brackets,
  DataSource,
  EntityManager,
  In,
  IsNull,
  Not,
  Repository,
} from 'typeorm';
import {
  EstadoReclamo,
  Reclamo,
  ReclamoAdjunto,
  ReclamoEvento,
  TipoEventoReclamo,
  Unidad,
  UnidadUsuario,
} from '../../database/entities';
import { ListarReclamosQuery } from './dto/listar-reclamos.query';

/** Relaciones que la bandeja y el detalle necesitan siempre. */
const RELACIONES = {
  categoria: true,
  unidad: true,
  proveedor: true,
  creadoPor: true,
} as const;

@Injectable()
export class ReclamosRepository {
  constructor(
    @InjectRepository(Reclamo)
    private readonly reclamos: Repository<Reclamo>,
    @InjectRepository(ReclamoEvento)
    private readonly eventos: Repository<ReclamoEvento>,
    @InjectRepository(UnidadUsuario)
    private readonly vinculos: Repository<UnidadUsuario>,
    @InjectRepository(Unidad)
    private readonly unidades: Repository<Unidad>,
    private readonly dataSource: DataSource,
  ) {}

  // ── Consultas ──────────────────────────────────────────────────────────────

  /**
   * Unidades a las que el usuario está vinculado hoy. Un vínculo con `hasta`
   * en el pasado es un inquilino que se mudó: no tiene por qué seguir viendo
   * los reclamos de esa unidad.
   */
  async unidadesDelUsuario(usuarioId: string): Promise<string[]> {
    const vinculos = await this.vinculos
      .createQueryBuilder('v')
      .select('v.unidadId', 'unidadId')
      .where('v.usuarioId = :usuarioId', { usuarioId })
      .andWhere(
        new Brackets((qb) =>
          qb.where('v.hasta IS NULL').orWhere('v.hasta >= CURRENT_DATE'),
        ),
      )
      .getRawMany<{ unidadId: string }>();

    return vinculos.map((v) => v.unidadId);
  }

  findUnidad(id: string): Promise<Unidad | null> {
    return this.unidades.findOne({ where: { id }, relations: { consorcio: true } });
  }

  findById(id: string): Promise<Reclamo | null> {
    return this.reclamos.findOne({
      where: { id },
      relations: { ...RELACIONES, reclamoAdjuntos: true },
    });
  }

  /**
   * Bandeja paginada. `unidadesPermitidas` llega desde el service: cuando es
   * un vecino trae sus unidades, y cuando es el administrador viene en
   * `undefined` para no filtrar.
   */
  async listar(
    query: ListarReclamosQuery,
    unidadesPermitidas?: string[],
  ): Promise<{ items: Reclamo[]; total: number }> {
    const pagina = query.pagina ?? 1;
    const limite = query.limite ?? 20;

    const qb = this.reclamos
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.categoria', 'categoria')
      .leftJoinAndSelect('r.unidad', 'unidad')
      .leftJoinAndSelect('r.proveedor', 'proveedor')
      .leftJoinAndSelect('r.creadoPor', 'creadoPor')
      .orderBy('r.createdAt', 'DESC')
      .skip((pagina - 1) * limite)
      .take(limite);

    if (unidadesPermitidas) {
      // Sin unidades vinculadas no ve nada. `In([])` genera `IN ()`, que en
      // Postgres es un error de sintaxis, así que se corta con un FALSE.
      if (unidadesPermitidas.length === 0) {
        qb.andWhere('1 = 0');
      } else {
        qb.andWhere('r.unidadId IN (:...unidades)', { unidades: unidadesPermitidas });
      }
    }

    if (query.estado) qb.andWhere('r.estado = :estado', { estado: query.estado });
    if (query.situacion === 'abiertos') {
      qb.andWhere('r.estado != :resuelto', { resuelto: EstadoReclamo.RESUELTO });
    }
    if (query.situacion === 'cerrados') {
      qb.andWhere('r.estado = :resuelto', { resuelto: EstadoReclamo.RESUELTO });
    }
    if (query.prioridad) qb.andWhere('r.prioridad = :prioridad', { prioridad: query.prioridad });
    if (query.categoriaId) qb.andWhere('r.categoriaId = :cat', { cat: query.categoriaId });
    if (query.consorcioId) qb.andWhere('r.consorcioId = :cons', { cons: query.consorcioId });
    if (query.unidadId) qb.andWhere('r.unidadId = :uni', { uni: query.unidadId });
    if (query.proveedorId) qb.andWhere('r.proveedorId = :prov', { prov: query.proveedorId });
    if (query.buscar) {
      qb.andWhere(
        new Brackets((sub) =>
          sub
            .where('r.descripcion ILIKE :q', { q: `%${query.buscar}%` })
            .orWhere('r.codigo ILIKE :q', { q: `%${query.buscar}%` }),
        ),
      );
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  /**
   * Timeline del caso. `soloVisibles` la recorta para el vecino: las notas
   * internas del administrador no salen.
   */
  findEventos(reclamoId: string, soloVisibles: boolean): Promise<ReclamoEvento[]> {
    return this.eventos.find({
      where: {
        reclamoId,
        ...(soloVisibles ? { visibleParaVecino: true } : {}),
      },
      relations: { autor: true },
      order: { createdAt: 'DESC' },
    });
  }

  /** Números del encabezado de la bandeja. */
  async resumen(consorcioId?: string, unidades?: string[]) {
    // Los mismos filtros para las dos consultas: se arman una vez y se aplican
    // a cada query builder nuevo.
    const aplicarFiltros = <T extends { andWhere: Function }>(qb: T): T => {
      if (consorcioId) qb.andWhere('r.consorcioId = :consorcioId', { consorcioId });
      if (unidades) {
        if (unidades.length === 0) qb.andWhere('1 = 0');
        else qb.andWhere('r.unidadId IN (:...unidades)', { unidades });
      }
      return qb;
    };

    const filas = await aplicarFiltros(this.reclamos.createQueryBuilder('r'))
      .select('r.estado', 'estado')
      .addSelect('count(*)::int', 'cantidad')
      .groupBy('r.estado')
      .getRawMany<{ estado: EstadoReclamo; cantidad: number }>();

    const porEstado = Object.fromEntries(
      Object.values(EstadoReclamo).map((e) => [e, 0]),
    ) as Record<EstadoReclamo, number>;
    for (const f of filas) porEstado[f.estado] = f.cantidad;

    // Tiempo medio de resolución, en días, sobre los que ya se cerraron.
    const medio = await aplicarFiltros(this.reclamos.createQueryBuilder('r'))
      .select(
        'avg(extract(epoch from (r.cerrado_at - r.created_at)) / 86400)',
        'dias',
      )
      .andWhere('r.cerradoAt IS NOT NULL')
      .getRawOne<{ dias: string | null }>();

    const abiertos = Object.entries(porEstado)
      .filter(([estado]) => estado !== EstadoReclamo.RESUELTO)
      .reduce((total, [, cantidad]) => total + cantidad, 0);

    return {
      porEstado,
      abiertos,
      resueltos: porEstado[EstadoReclamo.RESUELTO],
      diasPromedioResolucion:
        medio?.dias == null ? null : Number(Number(medio.dias).toFixed(1)),
    };
  }

  // ── Escrituras ─────────────────────────────────────────────────────────────

  /**
   * Crea el reclamo, sus adjuntos y el evento de apertura en una transacción:
   * un reclamo sin su evento de creación dejaría la timeline mintiendo.
   *
   * El código (`RC-2026-0184`) se arma acá adentro. La base lo exige único y
   * no tiene default, así que lo numera la app; si dos altas simultáneas sacan
   * el mismo número, el UNIQUE rechaza una y se reintenta.
   */
  async crear(datos: {
    consorcioId: string;
    unidadId: string;
    creadoPorId: string;
    categoriaId: string;
    descripcion: string;
    prioridad: Reclamo['prioridad'];
    adjuntos: { url: string; nombre?: string }[];
  }): Promise<Reclamo> {
    const INTENTOS = 5;

    for (let intento = 1; intento <= INTENTOS; intento++) {
      try {
        const id = await this.dataSource.transaction(async (m) => {
          const reclamo = await m.getRepository(Reclamo).save(
            m.getRepository(Reclamo).create({
              codigo: await this.siguienteCodigo(m),
              consorcioId: datos.consorcioId,
              unidadId: datos.unidadId,
              creadoPorId: datos.creadoPorId,
              categoriaId: datos.categoriaId,
              descripcion: datos.descripcion,
              prioridad: datos.prioridad,
              estado: EstadoReclamo.NUEVO,
            }),
          );

          if (datos.adjuntos.length) {
            await m.getRepository(ReclamoAdjunto).save(
              datos.adjuntos.map((a, orden) =>
                m.getRepository(ReclamoAdjunto).create({
                  reclamoId: reclamo.id,
                  url: a.url,
                  nombre: a.nombre ?? null,
                  orden,
                }),
              ),
            );
          }

          await m.getRepository(ReclamoEvento).save(
            m.getRepository(ReclamoEvento).create({
              reclamoId: reclamo.id,
              autorId: datos.creadoPorId,
              tipo: TipoEventoReclamo.CREACION,
              estadoNuevo: EstadoReclamo.NUEVO,
              visibleParaVecino: true,
            }),
          );

          return reclamo.id;
        });

        return (await this.findById(id))!;
      } catch (error) {
        // 23505 = unique_violation. Otro reclamo ganó el número: se reintenta.
        const codigoPg = (error as { code?: string }).code;
        if (codigoPg !== '23505' || intento === INTENTOS) throw error;
      }
    }

    // Inalcanzable: el for sale por return o por throw.
    throw new Error('No se pudo generar un código de reclamo');
  }

  /** `RC-<año>-<secuencia de 4>`, el formato que usa el prototipo. */
  private async siguienteCodigo(m: EntityManager): Promise<string> {
    const anio = new Date().getFullYear();
    const prefijo = `RC-${anio}-`;

    const ultimo = await m
      .getRepository(Reclamo)
      .createQueryBuilder('r')
      .select('r.codigo', 'codigo')
      .where('r.codigo LIKE :prefijo', { prefijo: `${prefijo}%` })
      .orderBy('r.codigo', 'DESC')
      .limit(1)
      .getRawOne<{ codigo: string }>();

    const numero = ultimo ? Number(ultimo.codigo.slice(prefijo.length)) + 1 : 1;
    return `${prefijo}${String(numero).padStart(4, '0')}`;
  }

  /** Guarda el cambio del reclamo y su evento juntos, o no guarda ninguno. */
  async actualizarConEvento(
    reclamo: Reclamo,
    evento: Partial<ReclamoEvento>,
  ): Promise<Reclamo> {
    await this.dataSource.transaction(async (m) => {
      await m.getRepository(Reclamo).save(reclamo);
      await m
        .getRepository(ReclamoEvento)
        .save(m.getRepository(ReclamoEvento).create(evento));
    });
    return (await this.findById(reclamo.id))!;
  }

  /** Sólo agrega a la timeline, sin tocar el reclamo. */
  async agregarEvento(evento: Partial<ReclamoEvento>): Promise<ReclamoEvento> {
    return this.eventos.save(this.eventos.create(evento));
  }

  /** Reclamos abiertos de una unidad, para no duplicar el mismo caso. */
  contarAbiertosDeUnidad(unidadId: string): Promise<number> {
    return this.reclamos.count({
      where: { unidadId, estado: Not(In([EstadoReclamo.RESUELTO])) },
    });
  }

  /** Los que siguen abiertos hace rato, para el panel del administrador. */
  findSinAsignar(consorcioId: string): Promise<Reclamo[]> {
    return this.reclamos.find({
      where: {
        consorcioId,
        proveedorId: IsNull(),
        estado: Not(In([EstadoReclamo.RESUELTO])),
      },
      relations: RELACIONES,
      order: { createdAt: 'ASC' },
    });
  }
}
