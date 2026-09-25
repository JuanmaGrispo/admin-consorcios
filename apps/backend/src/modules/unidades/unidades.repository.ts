import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Unidad, UnidadUsuario } from '../../database/entities';

/**
 * Un vínculo está vigente mientras no tenga `hasta` o `hasta` no haya pasado.
 * Es el mismo criterio que usa reclamos para decidir qué ve cada vecino.
 */
const VIGENTE = new Brackets((qb) =>
  qb.where('v.hasta IS NULL').orWhere('v.hasta >= CURRENT_DATE'),
);

@Injectable()
export class UnidadesRepository {
  constructor(
    @InjectRepository(Unidad)
    private readonly unidades: Repository<Unidad>,
    @InjectRepository(UnidadUsuario)
    private readonly vinculos: Repository<UnidadUsuario>,
  ) {}

  // ── Unidades ───────────────────────────────────────────────────────────────

  /** Cada unidad sale con cuántos vecinos tiene vinculados hoy. */
  listar(filtro: {
    consorcioId?: string;
    /** Si viene, sólo esas unidades (el vecino ve las suyas). */
    ids?: string[];
    incluirInactivas: boolean;
  }): Promise<Unidad[]> {
    const qb = this.unidades
      .createQueryBuilder('u')
      .loadRelationCountAndMap('u.cantidadVecinos', 'u.unidadUsuarios', 'v', (sub) =>
        sub.where(VIGENTE),
      )
      .orderBy('u.etiqueta', 'ASC');

    if (filtro.consorcioId) {
      qb.andWhere('u.consorcioId = :consorcioId', { consorcioId: filtro.consorcioId });
    }
    if (filtro.ids) {
      // `IN ()` es un error de sintaxis en Postgres: sin ids no hay nada que ver.
      if (filtro.ids.length === 0) qb.andWhere('1 = 0');
      else qb.andWhere('u.id IN (:...ids)', { ids: filtro.ids });
    }
    if (!filtro.incluirInactivas) qb.andWhere('u.activa = true');

    return qb.getMany();
  }

  findById(id: string): Promise<Unidad | null> {
    return this.unidades.findOneBy({ id });
  }

  findByEtiqueta(consorcioId: string, etiqueta: string): Promise<Unidad | null> {
    return this.unidades.findOneBy({ consorcioId, etiqueta });
  }

  /** Suma de coeficientes de las unidades activas del consorcio. */
  async sumaCoeficientes(consorcioId: string, excluirId?: string): Promise<number> {
    const qb = this.unidades
      .createQueryBuilder('u')
      .select('coalesce(sum(u.coeficiente), 0)', 'suma')
      .where('u.consorcioId = :consorcioId', { consorcioId })
      .andWhere('u.activa = true');
    if (excluirId) qb.andWhere('u.id != :excluirId', { excluirId });

    const fila = await qb.getRawOne<{ suma: string }>();
    return Number(fila?.suma ?? 0);
  }

  create(data: Partial<Unidad>): Promise<Unidad> {
    return this.unidades.save(this.unidades.create(data));
  }

  async update(unidad: Unidad, data: Partial<Unidad>): Promise<Unidad> {
    await this.unidades.save({ ...unidad, ...data });
    return (await this.findById(unidad.id))!;
  }

  // ── Vínculos vecino ↔ unidad ───────────────────────────────────────────────

  /**
   * La fecha de hoy según la base. Las fechas de los vínculos las pone y las
   * compara Postgres (`desde` tiene default CURRENT_DATE), así que "hoy" tiene
   * que salir del mismo reloj: el de la app puede estar en otro huso.
   */
  async hoy(): Promise<string> {
    const [fila] = await this.vinculos.query('SELECT CURRENT_DATE::text AS hoy');
    return (fila as { hoy: string }).hoy;
  }

  /** IDs de las unidades a las que el usuario está vinculado hoy. */
  async unidadesDelUsuario(usuarioId: string): Promise<string[]> {
    const filas = await this.vinculos
      .createQueryBuilder('v')
      .select('v.unidadId', 'unidadId')
      .where('v.usuarioId = :usuarioId', { usuarioId })
      .andWhere(VIGENTE)
      .getRawMany<{ unidadId: string }>();
    return filas.map((f) => f.unidadId);
  }

  listarVinculos(unidadId: string, incluirTerminados: boolean): Promise<UnidadUsuario[]> {
    const qb = this.vinculos
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.usuario', 'usuario')
      .where('v.unidadId = :unidadId', { unidadId })
      .orderBy('v.esTitular', 'DESC')
      .addOrderBy('v.desde', 'ASC');
    if (!incluirTerminados) qb.andWhere(VIGENTE);
    return qb.getMany();
  }

  findVinculo(id: string): Promise<UnidadUsuario | null> {
    return this.vinculos.findOne({ where: { id }, relations: { usuario: true } });
  }

  findVinculoVigente(unidadId: string, usuarioId: string): Promise<UnidadUsuario | null> {
    return this.vinculos
      .createQueryBuilder('v')
      .where('v.unidadId = :unidadId', { unidadId })
      .andWhere('v.usuarioId = :usuarioId', { usuarioId })
      .andWhere(VIGENTE)
      .getOne();
  }

  findTitularVigente(unidadId: string): Promise<UnidadUsuario | null> {
    return this.vinculos
      .createQueryBuilder('v')
      .where('v.unidadId = :unidadId', { unidadId })
      .andWhere('v.esTitular = true')
      .andWhere(VIGENTE)
      .getOne();
  }

  async crearVinculo(data: Partial<UnidadUsuario>): Promise<UnidadUsuario> {
    const creado = await this.vinculos.save(this.vinculos.create(data));
    return (await this.findVinculo(creado.id))!;
  }

  async terminarVinculo(id: string, hasta: string): Promise<void> {
    await this.vinculos.update({ id }, { hasta });
  }

  async borrarVinculo(id: string): Promise<void> {
    await this.vinculos.delete({ id });
  }
}
