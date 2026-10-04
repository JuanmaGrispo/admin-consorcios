import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Novedad, NovedadAdjunto, NovedadLectura } from '../../database/entities';

export interface FiltroNovedades {
  /** `undefined` = todos los consorcios (superadmin). */
  consorcioIds?: string[];
  consorcioId?: string;
  /** Lo que ve el vecino: activas y publicadas. */
  soloVisibles: boolean;
  pagina: number;
  limite: number;
}

@Injectable()
export class NovedadesRepository {
  constructor(
    @InjectRepository(Novedad)
    private readonly novedades: Repository<Novedad>,
    @InjectRepository(NovedadLectura)
    private readonly lecturas: Repository<NovedadLectura>,
  ) {}

  async listar(filtro: FiltroNovedades): Promise<{ items: Novedad[]; total: number }> {
    const qb = this.novedades
      .createQueryBuilder('n')
      .leftJoinAndSelect('n.novedadAdjuntos', 'adjunto')
      .leftJoin('n.autor', 'autor')
      .addSelect(['autor.id', 'autor.nombre', 'autor.apellido'])
      .orderBy('n.fijada', 'DESC')
      .addOrderBy('n.publicadaAt', 'DESC', 'NULLS LAST')
      .skip((filtro.pagina - 1) * filtro.limite)
      .take(filtro.limite);

    if (filtro.consorcioIds) {
      if (filtro.consorcioIds.length === 0) qb.andWhere('1 = 0');
      else qb.andWhere('n.consorcioId IN (:...consorcioIds)', { consorcioIds: filtro.consorcioIds });
    }
    if (filtro.consorcioId) qb.andWhere('n.consorcioId = :consorcioId', { consorcioId: filtro.consorcioId });
    if (filtro.soloVisibles) qb.andWhere('n.activa = true AND n.publicadaAt IS NOT NULL');

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  findById(id: string): Promise<Novedad | null> {
    return this.novedades
      .createQueryBuilder('n')
      .leftJoinAndSelect('n.novedadAdjuntos', 'adjunto')
      .leftJoin('n.autor', 'autor')
      .addSelect(['autor.id', 'autor.nombre', 'autor.apellido'])
      .where('n.id = :id', { id })
      .getOne();
  }

  /** Consorcios donde el vecino tiene hoy un vínculo vigente. */
  async consorciosDelVecino(usuarioId: string): Promise<string[]> {
    const filas: { consorcioId: string }[] = await this.novedades.manager.query(
      `SELECT DISTINCT un.consorcio_id AS "consorcioId"
         FROM unidad_usuario uu JOIN unidad un ON un.id = uu.unidad_id
        WHERE uu.usuario_id = $1 AND (uu.hasta IS NULL OR uu.hasta >= CURRENT_DATE)`,
      [usuarioId],
    );
    return filas.map((f) => f.consorcioId);
  }

  async leidasPor(usuarioId: string, novedadIds: string[]): Promise<Set<string>> {
    if (novedadIds.length === 0) return new Set();
    const filas = await this.lecturas.find({
      select: { novedadId: true },
      where: { usuarioId, novedadId: In(novedadIds) },
    });
    return new Set(filas.map((f) => f.novedadId));
  }

  async contarLecturas(novedadIds: string[]): Promise<Map<string, number>> {
    if (novedadIds.length === 0) return new Map();
    const filas: { novedadId: string; cantidad: number }[] = await this.lecturas
      .createQueryBuilder('l')
      .select('l.novedadId', 'novedadId')
      .addSelect('count(*)::int', 'cantidad')
      .where('l.novedadId IN (:...novedadIds)', { novedadIds })
      .groupBy('l.novedadId')
      .getRawMany();
    return new Map(filas.map((f) => [f.novedadId, f.cantidad]));
  }

  /** La novedad y sus adjuntos, juntos o ninguno. */
  async crear(datos: Partial<Novedad>, adjuntos: Partial<NovedadAdjunto>[]): Promise<Novedad> {
    const id = await this.novedades.manager.transaction(async (m) => {
      const novedad = await m.save(m.create(Novedad, datos));
      if (adjuntos.length > 0) {
        await m.save(adjuntos.map((a) => m.create(NovedadAdjunto, { ...a, novedadId: novedad.id })));
      }
      return novedad.id;
    });
    return (await this.findById(id))!;
  }

  async administradorDe(consorcioId: string): Promise<string | null> {
    const [fila] = await this.novedades.manager.query(
      'SELECT administrador_id AS "administradorId" FROM consorcio WHERE id = $1',
      [consorcioId],
    );
    return fila?.administradorId ?? null;
  }

  /**
   * La novedad de un evento y la marca de que el consumidor ya lo procesó, en
   * la misma transacción: si el evento llega repetido, el INSERT de la marca
   * no hace nada y la novedad no se duplica. Devuelve `false` en ese caso.
   */
  async crearDesdeEvento(
    eventoId: string,
    consumidor: string,
    datos: Partial<Novedad>,
  ): Promise<boolean> {
    return this.novedades.manager.transaction(async (m) => {
      const marcado: unknown[] = await m.query(
        `INSERT INTO evento_procesado (evento_id, consumidor) VALUES ($1, $2)
         ON CONFLICT DO NOTHING RETURNING evento_id`,
        [eventoId, consumidor],
      );
      if (marcado.length === 0) return false;
      await m.save(m.create(Novedad, datos));
      return true;
    });
  }

  async actualizar(novedad: Novedad, datos: Partial<Novedad>): Promise<Novedad> {
    await this.novedades.update({ id: novedad.id }, datos);
    return (await this.findById(novedad.id))!;
  }

  /** Marcarla dos veces no es un error: el UNIQUE (novedad, usuario) la deja en una. */
  async marcarLeida(novedadId: string, usuarioId: string): Promise<void> {
    await this.lecturas
      .createQueryBuilder()
      .insert()
      .values({ novedadId, usuarioId })
      .orIgnore()
      .execute();
  }
}
