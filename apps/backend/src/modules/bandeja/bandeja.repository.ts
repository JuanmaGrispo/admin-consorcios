import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Notificacion } from '../../database/entities';
import type { AvisoDeBandeja } from './bandeja';

/** Vínculo vigente con una unidad activa y cuenta activa: el mismo criterio que el mail. */
const VECINOS_VIGENTES = `
  SELECT DISTINCT us.id AS "usuarioId"
    FROM unidad_usuario uu
    JOIN unidad un ON un.id = uu.unidad_id
    JOIN usuario us ON us.id = uu.usuario_id
   WHERE un.activa AND us.activo
     AND (uu.hasta IS NULL OR uu.hasta >= CURRENT_DATE)`;

const CONSUMIDOR = 'bandeja-notificaciones';

@Injectable()
export class BandejaRepository {
  constructor(
    @InjectRepository(Notificacion)
    private readonly notificaciones: Repository<Notificacion>,
  ) {}

  async vecinosDelConsorcio(consorcioId: string): Promise<string[]> {
    const filas: { usuarioId: string }[] = await this.notificaciones.manager.query(
      `${VECINOS_VIGENTES} AND un.consorcio_id = $1`,
      [consorcioId],
    );
    return filas.map((f) => f.usuarioId);
  }

  async vecinosDeUnidades(unidadIds: string[]): Promise<string[]> {
    if (unidadIds.length === 0) return [];
    const filas: { usuarioId: string }[] = await this.notificaciones.manager.query(
      `${VECINOS_VIGENTES} AND un.id = ANY($1)`,
      [unidadIds],
    );
    return filas.map((f) => f.usuarioId);
  }

  async estaActivo(usuarioId: string): Promise<boolean> {
    const [fila] = await this.notificaciones.manager.query(
      'SELECT 1 FROM usuario WHERE id = $1 AND activo',
      [usuarioId],
    );
    return !!fila;
  }

  /**
   * Un aviso por destinatario, junto con la marca en `evento_procesado`: si el
   * evento vuelve (reintento, mensaje duplicado), no se repite. Devuelve false
   * si ya se había procesado.
   */
  guardar(eventoId: string, usuarioIds: string[], aviso: AvisoDeBandeja): Promise<boolean> {
    return this.notificaciones.manager.transaction(async (m) => {
      const marcado: unknown[] = await m.query(
        `INSERT INTO evento_procesado (evento_id, consumidor) VALUES ($1, $2)
         ON CONFLICT DO NOTHING RETURNING evento_id`,
        [eventoId, CONSUMIDOR],
      );
      if (marcado.length === 0) return false;
      if (usuarioIds.length > 0) {
        await m.insert(
          Notificacion,
          usuarioIds.map((usuarioId) => ({ usuarioId, ...aviso })),
        );
      }
      return true;
    });
  }

  listar(
    usuarioId: string,
    opciones: { soloNoLeidas: boolean; pagina: number; limite: number },
  ): Promise<[Notificacion[], number]> {
    return this.notificaciones.findAndCount({
      where: { usuarioId, ...(opciones.soloNoLeidas ? { leidaAt: IsNull() } : {}) },
      order: { createdAt: 'DESC' },
      skip: (opciones.pagina - 1) * opciones.limite,
      take: opciones.limite,
    });
  }

  contarNoLeidas(usuarioId: string): Promise<number> {
    return this.notificaciones.countBy({ usuarioId, leidaAt: IsNull() });
  }

  /** Sólo la propia: la de otro no se encuentra. Repetirlo no cambia la fecha. */
  async marcarLeida(usuarioId: string, id: string): Promise<boolean> {
    if (!(await this.notificaciones.existsBy({ id, usuarioId }))) return false;
    await this.notificaciones.update({ id, usuarioId, leidaAt: IsNull() }, { leidaAt: new Date() });
    return true;
  }

  async marcarTodas(usuarioId: string): Promise<void> {
    await this.notificaciones.update({ usuarioId, leidaAt: IsNull() }, { leidaAt: new Date() });
  }
}
