import { ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { EventoDomus } from '../../core/mensajeria/eventos';
import { registrarEventos } from '../../core/mensajeria/outbox.repository';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Brackets,
  DataSource,
  In,
  IsNull,
  Not,
  Repository,
  SelectQueryBuilder,
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

/** Relaciones de los listados relacionados. */
const RELACIONES = { categoria: true, unidad: true, proveedor: true, creadoPor: true } as const;

/** Qué reclamos puede ver alguien: los de sus unidades (vecino) o de sus consorcios (administrador). */
export interface AlcanceReclamos {
  unidades?: string[];
  consorcios?: string[];
}

// `IN ()` es un error de sintaxis en Postgres: una lista vacía se corta con un FALSE.
function aplicarAlcance(qb: SelectQueryBuilder<Reclamo>, alcance: AlcanceReclamos) {
  if (alcance.unidades) {
    if (alcance.unidades.length === 0) qb.andWhere('1 = 0');
    else qb.andWhere('r.unidadId IN (:...unidades)', { unidades: alcance.unidades });
  }
  if (alcance.consorcios) {
    if (alcance.consorcios.length === 0) qb.andWhere('1 = 0');
    else qb.andWhere('r.consorcioId IN (:...consorcios)', { consorcios: alcance.consorcios });
  }
  return qb;
}

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
          qb.where('v.hasta IS NULL').orWhere('v.hasta > CURRENT_DATE'),
        ),
      )
      .getRawMany<{ unidadId: string }>();

    return vinculos.map((v) => v.unidadId);
  }

  findUnidad(id: string): Promise<Unidad | null> {
    return this.unidades.createQueryBuilder('u').leftJoinAndSelect('u.consorcio', 'c')
      .where('u.id = :id', { id }).getOne();
  }

  findById(id: string, repo = this.reclamos): Promise<Reclamo | null> {
    return repo.createQueryBuilder('r')
      .leftJoinAndSelect('r.categoria', 'categoria')
      .leftJoinAndSelect('r.unidad', 'unidad')
      .leftJoinAndSelect('r.proveedor', 'proveedor')
      .leftJoinAndSelect('r.creadoPor', 'autor')
      .leftJoinAndSelect('r.reclamoAdjuntos', 'adjunto')
      .where('r.id = :id', { id }).getOne();
  }

  /**
   * Bandeja paginada. `unidadesPermitidas` llega desde el service: cuando es
   * un vecino trae sus unidades, y cuando es el administrador viene en
   * `undefined` para no filtrar.
   */
  async listar(
    query: ListarReclamosQuery,
    alcance: AlcanceReclamos,
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

    aplicarAlcance(qb, alcance);

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
            .where('r.titulo ILIKE :q', { q: `%${query.buscar}%` })
            .orWhere('r.descripcion ILIKE :q', { q: `%${query.buscar}%` })
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
      relations: { autor: true, proveedor: true },
      order: { createdAt: 'DESC' },
    });
  }

  /** Números del encabezado de la bandeja. */
  /** Los NUEVO sin proveedor abiertos hace más de `dias`, el más viejo primero. */
  sinAsignar(alcance: AlcanceReclamos, dias: number, limite: number): Promise<Reclamo[]> {
    const qb = this.reclamos
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.unidad', 'unidad')
      .leftJoinAndSelect('r.categoria', 'categoria')
      .where('r.estado = :nuevo', { nuevo: EstadoReclamo.NUEVO })
      .andWhere('r.proveedorId IS NULL')
      .andWhere(`r.createdAt < now() - make_interval(days => :dias)`, { dias })
      .orderBy('r.createdAt', 'ASC')
      .take(limite);
    return aplicarAlcance(qb, alcance).getMany();
  }

  async resumen(consorcioId: string | undefined, alcance: AlcanceReclamos) {
    // Los mismos filtros para las dos consultas: se arman una vez y se aplican
    // a cada query builder nuevo.
    const aplicarFiltros = (qb: SelectQueryBuilder<Reclamo>) => {
      if (consorcioId) qb.andWhere('r.consorcioId = :consorcioId', { consorcioId });
      return aplicarAlcance(qb, alcance);
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
    titulo: string;
    descripcion: string;
    prioridad: Reclamo['prioridad'];
    adjuntos: { url: string; nombre?: string }[];
  }, idempotencia?: { usuarioId: string; clave: string; huella: string }, eventos: (creado: Reclamo) => EventoDomus[] = () => []): Promise<Reclamo> {
    const INTENTOS = 5;

    for (let intento = 1; intento <= INTENTOS; intento++) {
      try {
        return await this.dataSource.transaction(async (m) => {
          if (idempotencia) {
            await m.query(`SET LOCAL lock_timeout = '3s'`);
            await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`reclamos:${idempotencia.usuarioId}:${idempotencia.clave}`]);
            const [previa] = await m.query(`SELECT huella,respuesta FROM solicitud_idempotente
              WHERE usuario_id=$1 AND metodo='POST' AND ruta='/reclamos' AND clave=$2`, [idempotencia.usuarioId, idempotencia.clave]);
            if (previa) {
              if (previa.huella !== idempotencia.huella) throw new ConflictException('La clave ya fue utilizada con otro contenido');
              return previa.respuesta;
            }
          }
          const insercion = await m.getRepository(Reclamo).insert({
              codigo: () => `('RC-' || extract(year FROM CURRENT_DATE)::text || '-' ||
                (SELECT repeat('0', greatest(0, 4-length(n))) || n
                 FROM (SELECT nextval('reclamo_numero')::text AS n) numeracion))`,
              consorcioId: datos.consorcioId,
              unidadId: datos.unidadId,
              creadoPorId: datos.creadoPorId,
              categoriaId: datos.categoriaId,
              titulo: datos.titulo,
              descripcion: datos.descripcion,
              prioridad: datos.prioridad,
              estado: EstadoReclamo.NUEVO,
          });
          const reclamo = { id: insercion.identifiers[0].id as string };

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

          await m.getRepository(ReclamoEvento).insert({
              reclamoId: reclamo.id,
              autorId: datos.creadoPorId,
              tipo: TipoEventoReclamo.CREACION,
              estadoNuevo: EstadoReclamo.NUEVO,
              visibleParaVecino: true,
          });

          const completo = await this.findById(reclamo.id, m.getRepository(Reclamo));
          if (!completo) throw new Error('No se encontró el reclamo recién creado');
          await registrarEventos(m, eventos(completo));
          const respuesta = JSON.parse(JSON.stringify(completo));
          if (idempotencia) await m.query(`INSERT INTO solicitud_idempotente(usuario_id,metodo,ruta,clave,huella,estado_http,respuesta)
            VALUES ($1,'POST','/reclamos',$2,$3,201,$4)`, [idempotencia.usuarioId, idempotencia.clave, idempotencia.huella, respuesta]);
          return respuesta;
        });
      } catch (error) {
        // 23505 = unique_violation. Otro reclamo ganó el número: se reintenta.
        const codigoPg = (error as { code?: string }).code;
        if (codigoPg === '55P03') throw new ServiceUnavailableException({ message: 'La solicitud está en curso. Reintentá con la misma clave en unos segundos.', retryAfter: 3 });
        if (codigoPg !== '23505' || intento === INTENTOS) throw error;
      }
    }

    // Inalcanzable: el for sale por return o por throw.
    throw new Error('No se pudo generar un código de reclamo');
  }

  /** Guarda el cambio del reclamo y su evento juntos, o no guarda ninguno. */
  async actualizarConEvento(
    reclamo: Reclamo,
    evento: Partial<ReclamoEvento>,
    eventos: EventoDomus[] = [],
  ): Promise<Reclamo> {
    await this.dataSource.transaction(async (m) => {
      await m.getRepository(Reclamo).save(reclamo);
      await m
        .getRepository(ReclamoEvento)
        .save(m.getRepository(ReclamoEvento).create(evento));
      await registrarEventos(m, eventos);
    });
    return (await this.findById(reclamo.id))!;
  }

  /** Sólo agrega a la timeline, sin tocar el reclamo. */
  async agregarEvento(evento: Partial<ReclamoEvento>, eventos: EventoDomus[] = []): Promise<ReclamoEvento> {
    return this.dataSource.transaction(async (m) => {
      const registro = await m.save(m.create(ReclamoEvento, evento));
      await registrarEventos(m, eventos);
      return registro;
    });
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
