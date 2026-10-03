import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Brackets,
  DataSource,
  DeepPartial,
  EntityManager,
  In,
  IsNull,
  LessThanOrEqual,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
  Asistencia,
  EstadoVotacion,
  OpcionVoto,
  PuntoOrdenDia,
  Unidad,
  UnidadUsuario,
  VinculoUnidad,
  Votacion,
  Voto,
} from '../../database/entities';
import { ListarVotacionesQuery } from './dto/listar-votaciones.query';
import type { UnidadParaPadron } from './padron';

export const ETIQUETA_A_FAVOR = 'A favor';
export const ETIQUETA_EN_CONTRA = 'En contra';

/** Relaciones que el detalle, el voto y el cierre necesitan siempre. */
const RELACIONES = { opcionVotos: true, asamblea: true } as const;
const ORDEN_OPCIONES = { opcionVotos: { orden: 'ASC' } } as const;

@Injectable()
export class VotacionesRepository {
  constructor(
    @InjectRepository(Votacion)
    private readonly votaciones: Repository<Votacion>,
    @InjectRepository(OpcionVoto)
    private readonly opciones: Repository<OpcionVoto>,
    @InjectRepository(Voto)
    private readonly votos: Repository<Voto>,
    @InjectRepository(PuntoOrdenDia)
    private readonly puntos: Repository<PuntoOrdenDia>,
    @InjectRepository(Asistencia)
    private readonly asistenciasRepo: Repository<Asistencia>,
    @InjectRepository(Unidad)
    private readonly unidades: Repository<Unidad>,
    @InjectRepository(UnidadUsuario)
    private readonly vinculos: Repository<UnidadUsuario>,
    private readonly dataSource: DataSource,
  ) {}

  // ── Votaciones ─────────────────────────────────────────────────────────────

  listar(
    query: ListarVotacionesQuery,
    filtro: { consorcioIds?: string[]; ocultarBorradores: boolean },
  ): Promise<Votacion[]> {
    if (filtro.consorcioIds && filtro.consorcioIds.length === 0) return Promise.resolve([]);

    const qb = this.votaciones
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.opcionVotos', 'o')
      .orderBy('v.apertura', 'DESC')
      .addOrderBy('o.orden', 'ASC');

    if (query.consorcioId) qb.andWhere('v.consorcio_id = :consorcioId', { consorcioId: query.consorcioId });
    if (filtro.consorcioIds) qb.andWhere('v.consorcio_id IN (:...consorcioIds)', { consorcioIds: filtro.consorcioIds });
    if (query.asambleaId) qb.andWhere('v.asamblea_id = :asambleaId', { asambleaId: query.asambleaId });
    if (filtro.ocultarBorradores) qb.andWhere('v.estado <> :borrador', { borrador: EstadoVotacion.BORRADOR });
    if (query.estado) qb.andWhere('v.estado = :estado', { estado: query.estado });

    return qb.getMany();
  }

  findById(id: string): Promise<Votacion | null> {
    return this.votaciones.findOne({ where: { id }, relations: RELACIONES, order: ORDEN_OPCIONES });
  }

  /** Independientes abiertas con el cierre ya pasado: se cierran en la próxima consulta. */
  abiertasVencidas(): Promise<Votacion[]> {
    return this.votaciones.find({
      where: { estado: EstadoVotacion.ABIERTA, asambleaId: IsNull(), cierre: LessThanOrEqual(new Date()) },
      relations: RELACIONES,
      order: ORDEN_OPCIONES,
    });
  }

  abiertas(consorcioIds: string[]): Promise<Votacion[]> {
    return this.votaciones.find({
      where: { consorcioId: In(consorcioIds), estado: EstadoVotacion.ABIERTA },
      order: { cierre: 'ASC' },
    });
  }

  findPunto(id: string): Promise<PuntoOrdenDia | null> {
    return this.puntos.findOne({ where: { id }, relations: { asamblea: true } });
  }

  async puntoTieneVotacion(puntoOrdenDiaId: string): Promise<boolean> {
    return (await this.votaciones.count({ where: { puntoOrdenDiaId } })) > 0;
  }

  /** La votación nace con sus dos opciones fijas: sin ellas no hay resultado posible. */
  crear(datos: DeepPartial<Votacion>, extras: string[]): Promise<string> {
    return this.dataSource.transaction(async (m) => {
      const votacion = await m.save(m.create(Votacion, datos));
      await m.save([
        m.create(OpcionVoto, { votacionId: votacion.id, etiqueta: ETIQUETA_A_FAVOR, orden: 1, esFija: true }),
        m.create(OpcionVoto, { votacionId: votacion.id, etiqueta: ETIQUETA_EN_CONTRA, orden: 2, esFija: true }),
      ]);
      await this.insertarExtras(m, votacion.id, extras);
      return votacion.id;
    });
  }

  async actualizar(id: string, cambios: QueryDeepPartialEntity<Votacion>): Promise<void> {
    await this.votaciones.update({ id }, { ...cambios, updatedAt: new Date() });
  }

  async reemplazarOpciones(votacionId: string, extras: string[]): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      await m.delete(OpcionVoto, { votacionId, esFija: false });
      await this.insertarExtras(m, votacionId, extras);
    });
  }

  async eliminar(id: string): Promise<void> {
    await this.votaciones.delete({ id });
  }

  // ── Votos ──────────────────────────────────────────────────────────────────

  votosDe(votacionId: string): Promise<Voto[]> {
    return this.votos.find({ where: { votacionId }, relations: { emitidoPor: true } });
  }

  findVoto(votacionId: string, unidadId: string): Promise<Voto | null> {
    return this.votos.findOne({ where: { votacionId, unidadId }, relations: { emitidoPor: true } });
  }

  /**
   * `null` si la unidad ya votó. El chequeo previo del service no alcanza: dos
   * votos simultáneos pasan los dos, y el que decide es el UNIQUE de la base.
   */
  async crearVoto(datos: DeepPartial<Voto>): Promise<Voto | null> {
    try {
      return await this.votos.save(this.votos.create(datos));
    } catch (error) {
      if (esViolacionUnique(error)) return null;
      throw error;
    }
  }

  // ── Padrón, asamblea y vecinos ─────────────────────────────────────────────

  /** Unidades activas del consorcio con sus vínculos vigentes, para armar el padrón. */
  async unidadesParaPadron(consorcioId: string): Promise<UnidadParaPadron[]> {
    const unidades = await this.unidades.find({
      where: { consorcioId, activa: true },
      select: { id: true, etiqueta: true, coeficiente: true },
      order: { etiqueta: 'ASC' },
    });
    const vinculos = await this.vinculosVigentes()
      .select('v.unidad_id', 'unidadId')
      .addSelect('v.usuario_id', 'usuarioId')
      .addSelect('v.vinculo', 'vinculo')
      .andWhere('u.consorcio_id = :consorcioId', { consorcioId })
      .getRawMany<{ unidadId: string; usuarioId: string; vinculo: VinculoUnidad }>();

    return unidades.map((u) => ({
      unidadId: u.id,
      etiqueta: u.etiqueta,
      coeficiente: u.coeficiente,
      vinculos: vinculos
        .filter((v) => v.unidadId === u.id)
        .map((v) => ({ usuarioId: v.usuarioId, vinculo: v.vinculo })),
    }));
  }

  asistenciasDe(asambleaId: string): Promise<Asistencia[]> {
    return this.asistenciasRepo.find({ where: { asambleaId } });
  }

  async consorciosDelUsuario(usuarioId: string): Promise<string[]> {
    const filas = await this.vinculosVigentes()
      .select('DISTINCT u.consorcio_id', 'consorcioId')
      .andWhere('v.usuario_id = :usuarioId', { usuarioId })
      .getRawMany<{ consorcioId: string }>();
    return filas.map((f) => f.consorcioId);
  }

  async vecinosDelConsorcio(consorcioId: string): Promise<string[]> {
    const filas = await this.vinculosVigentes()
      .select('DISTINCT v.usuario_id', 'usuarioId')
      .andWhere('u.consorcio_id = :consorcioId', { consorcioId })
      .andWhere('u.activa = true')
      .getRawMany<{ usuarioId: string }>();
    return filas.map((f) => f.usuarioId);
  }

  // ── Privados ───────────────────────────────────────────────────────────────

  private vinculosVigentes(): SelectQueryBuilder<UnidadUsuario> {
    return this.vinculos
      .createQueryBuilder('v')
      .innerJoin('v.unidad', 'u')
      .where(new Brackets((qb) => qb.where('v.hasta IS NULL').orWhere('v.hasta >= CURRENT_DATE')));
  }

  /** Van después de las fijas (orden 1 y 2). */
  private async insertarExtras(m: EntityManager, votacionId: string, extras: string[]) {
    if (extras.length === 0) return;
    await m.save(
      extras.map((etiqueta, i) =>
        m.create(OpcionVoto, { votacionId, etiqueta, orden: i + 3, esFija: false }),
      ),
    );
  }
}

/** Postgres responde 23505 cuando se viola un UNIQUE. */
function esViolacionUnique(error: unknown): boolean {
  const e = error as { code?: string; driverError?: { code?: string } };
  return (e.code ?? e.driverError?.code) === '23505';
}
