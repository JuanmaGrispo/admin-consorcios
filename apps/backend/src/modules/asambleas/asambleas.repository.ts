import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Brackets,
  DataSource,
  DeepPartial,
  EntityManager,
  In,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import {
  Asamblea,
  Asistencia,
  EstadoAsamblea,
  EstadoAsistencia,
  EstadoVotacion,
  PuntoOrdenDia,
  TipoPuntoOrden,
  Unidad,
  UnidadUsuario,
  Votacion,
} from '../../database/entities';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ListarAsambleasQuery } from './dto/listar-asambleas.query';

export interface PuntoNuevo {
  titulo: string;
  descripcion?: string | null;
  tipo?: TipoPuntoOrden;
}

export interface AsistenciaNueva {
  unidadId: string;
  coeficienteAplicado: number;
}

/** Coeficientes presentes y totales de una asamblea, para el listado. */
export interface AgregadoQuorum {
  presente: number;
  total: number;
}

@Injectable()
export class AsambleasRepository {
  constructor(
    @InjectRepository(Asamblea)
    private readonly asambleas: Repository<Asamblea>,
    @InjectRepository(Asistencia)
    private readonly asistenciasRepo: Repository<Asistencia>,
    @InjectRepository(Unidad)
    private readonly unidades: Repository<Unidad>,
    @InjectRepository(UnidadUsuario)
    private readonly vinculos: Repository<UnidadUsuario>,
    @InjectRepository(Votacion)
    private readonly votaciones: Repository<Votacion>,
    private readonly dataSource: DataSource,
  ) {}

  // ── Asambleas ──────────────────────────────────────────────────────────────

  listar(
    query: ListarAsambleasQuery,
    filtro: { consorcioIds?: string[]; ocultarBorradores: boolean },
  ): Promise<Asamblea[]> {
    if (filtro.consorcioIds && filtro.consorcioIds.length === 0) return Promise.resolve([]);

    const qb = this.asambleas.createQueryBuilder('a').orderBy('a.fechaHora', 'DESC');

    if (query.consorcioId) qb.andWhere('a.consorcio_id = :consorcioId', { consorcioId: query.consorcioId });
    if (filtro.consorcioIds) qb.andWhere('a.consorcio_id IN (:...consorcioIds)', { consorcioIds: filtro.consorcioIds });
    if (filtro.ocultarBorradores) qb.andWhere('a.estado <> :borrador', { borrador: EstadoAsamblea.BORRADOR });
    if (query.estado) qb.andWhere('a.estado = :estado', { estado: query.estado });
    if (query.anio) qb.andWhere('EXTRACT(YEAR FROM a.fecha_hora) = :anio', { anio: query.anio });

    return qb.getMany();
  }

  /** Un solo `SUM` agrupado para todo el listado, en vez de una consulta por fila. */
  async agregadosQuorum(asambleaIds: string[]): Promise<Map<string, AgregadoQuorum>> {
    if (asambleaIds.length === 0) return new Map();

    const filas = await this.asistenciasRepo
      .createQueryBuilder('s')
      .select('s.asamblea_id', 'asambleaId')
      .addSelect(
        'SUM(CASE WHEN s.estado IN (:...presentes) THEN s.coeficiente_aplicado ELSE 0 END)',
        'presente',
      )
      .addSelect('SUM(s.coeficiente_aplicado)', 'total')
      .where('s.asamblea_id IN (:...asambleaIds)', { asambleaIds })
      .setParameter('presentes', [EstadoAsistencia.ASISTE, EstadoAsistencia.CON_PODER])
      .groupBy('s.asamblea_id')
      .getRawMany<{ asambleaId: string; presente: string; total: string }>();

    return new Map(
      filas.map((f) => [f.asambleaId, { presente: Number(f.presente), total: Number(f.total) }]),
    );
  }

  /** Convocadas o en curso, de la más cercana a la más lejana. */
  proximas(consorcioIds: string[]): Promise<Asamblea[]> {
    return this.asambleas.find({
      where: {
        consorcioId: In(consorcioIds),
        estado: In([EstadoAsamblea.CONVOCADA, EstadoAsamblea.EN_CURSO]),
      },
      order: { fechaHora: 'ASC' },
    });
  }

  findById(id: string): Promise<Asamblea | null> {
    return this.asambleas.findOne({
      where: { id },
      relations: { puntoOrdenDias: true },
      order: { puntoOrdenDias: { orden: 'ASC' } },
    });
  }

  crear(datos: DeepPartial<Asamblea>, puntos: PuntoNuevo[]): Promise<string> {
    return this.dataSource.transaction(async (m) => {
      const asamblea = await m.save(m.create(Asamblea, datos));
      await this.insertarPuntos(m, asamblea.id, puntos);
      return asamblea.id;
    });
  }

  async actualizar(id: string, cambios: QueryDeepPartialEntity<Asamblea>): Promise<void> {
    await this.asambleas.update({ id }, { ...cambios, updatedAt: new Date() });
  }

  /** Borra y reinserta: el orden lo da la posición y el UNIQUE (asamblea, orden) no deja renumerar en el lugar. */
  async reemplazarOrdenDia(asambleaId: string, puntos: PuntoNuevo[]): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      await m.delete(PuntoOrdenDia, { asambleaId });
      await this.insertarPuntos(m, asambleaId, puntos);
    });
  }

  async eliminar(id: string): Promise<void> {
    await this.asambleas.delete({ id });
  }

  // ── Convocatoria y asistencia ──────────────────────────────────────────────

  unidadesActivas(consorcioId: string): Promise<Pick<Unidad, 'id' | 'coeficiente'>[]> {
    return this.unidades.find({
      where: { consorcioId, activa: true },
      select: { id: true, coeficiente: true },
    });
  }

  /** El padrón de asistencia y el cambio de estado van juntos o no van. */
  async convocar(asambleaId: string, asistencias: AsistenciaNueva[]): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      await m.save(
        asistencias.map((a) => m.create(Asistencia, { ...a, asambleaId })),
        { chunk: 500 },
      );
      await m.update(Asamblea, { id: asambleaId }, { estado: EstadoAsamblea.CONVOCADA, updatedAt: new Date() });
    });
  }

  asistencias(asambleaId: string): Promise<Asistencia[]> {
    return this.asistenciasRepo.find({
      where: { asambleaId },
      relations: { unidad: true, apoderadoUnidad: true, confirmadaPor: true },
      order: { unidad: { etiqueta: 'ASC' } },
    });
  }

  findAsistencia(asambleaId: string, unidadId: string): Promise<Asistencia | null> {
    return this.asistenciasRepo.findOne({
      where: { asambleaId, unidadId },
      relations: { unidad: true, apoderadoUnidad: true, confirmadaPor: true },
    });
  }

  async guardarAsistencia(id: string, cambios: QueryDeepPartialEntity<Asistencia>): Promise<void> {
    await this.asistenciasRepo.update({ id }, { ...cambios, updatedAt: new Date() });
  }

  /** Una asamblea no se cierra con votaciones sin resultado. */
  votacionesAbiertas(asambleaId: string): Promise<number> {
    return this.votaciones.count({ where: { asambleaId, estado: EstadoVotacion.ABIERTA } });
  }

  // ── Vínculos ───────────────────────────────────────────────────────────────

  /** Consorcios donde el usuario tiene hoy alguna unidad. */
  async consorciosDelUsuario(usuarioId: string): Promise<string[]> {
    const filas = await this.vinculosVigentes()
      .select('DISTINCT u.consorcio_id', 'consorcioId')
      .andWhere('v.usuario_id = :usuarioId', { usuarioId })
      .getRawMany<{ consorcioId: string }>();
    return filas.map((f) => f.consorcioId);
  }

  async unidadesDelUsuarioEnConsorcio(usuarioId: string, consorcioId: string): Promise<string[]> {
    const filas = await this.vinculosVigentes()
      .select('v.unidad_id', 'unidadId')
      .andWhere('v.usuario_id = :usuarioId', { usuarioId })
      .andWhere('u.consorcio_id = :consorcioId', { consorcioId })
      .getRawMany<{ unidadId: string }>();
    return filas.map((f) => f.unidadId);
  }

  /** A quién avisar de una convocatoria: vecinos con vínculo vigente a una unidad activa. */
  async vecinosDelConsorcio(consorcioId: string): Promise<string[]> {
    const filas = await this.vinculosVigentes()
      .select('DISTINCT v.usuario_id', 'usuarioId')
      .andWhere('u.consorcio_id = :consorcioId', { consorcioId })
      .andWhere('u.activa = true')
      .getRawMany<{ usuarioId: string }>();
    return filas.map((f) => f.usuarioId);
  }

  // ── Privados ───────────────────────────────────────────────────────────────

  /** Un vínculo con `hasta` en el pasado es alguien que ya no vive ahí. */
  private vinculosVigentes(): SelectQueryBuilder<UnidadUsuario> {
    return this.vinculos
      .createQueryBuilder('v')
      .innerJoin('v.unidad', 'u')
      .where(new Brackets((qb) => qb.where('v.hasta IS NULL').orWhere('v.hasta >= CURRENT_DATE')));
  }

  private async insertarPuntos(m: EntityManager, asambleaId: string, puntos: PuntoNuevo[]) {
    if (puntos.length === 0) return;
    await m.save(
      puntos.map((p, i) =>
        m.create(PuntoOrdenDia, {
          asambleaId,
          orden: i + 1,
          titulo: p.titulo,
          descripcion: p.descripcion ?? null,
          tipo: p.tipo ?? TipoPuntoOrden.INFORMATIVO,
        }),
      ),
    );
  }
}
