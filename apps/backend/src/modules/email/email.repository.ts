import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EnvioNotificacion } from '../../database/entities';

export interface Destinatario {
  usuarioId: string;
  email: string;
  nombre: string;
}

export interface VecinoDeUnidad extends Destinatario {
  unidadId: string;
  etiqueta: string;
}

/** Vínculo vigente con una unidad activa, y cuenta activa: a quién tiene sentido escribirle. */
const VECINOS_VIGENTES = `
  SELECT DISTINCT us.id AS "usuarioId", us.email, us.nombre, un.id AS "unidadId", un.etiqueta
    FROM unidad_usuario uu
    JOIN unidad un ON un.id = uu.unidad_id
    JOIN usuario us ON us.id = uu.usuario_id
   WHERE un.activa AND us.activo
     AND (uu.hasta IS NULL OR uu.hasta >= CURRENT_DATE)`;

@Injectable()
export class EmailRepository {
  constructor(
    @InjectRepository(EnvioNotificacion)
    private readonly envios: Repository<EnvioNotificacion>,
  ) {}

  vecinosDelConsorcio(consorcioId: string): Promise<VecinoDeUnidad[]> {
    return this.envios.manager.query(`${VECINOS_VIGENTES} AND un.consorcio_id = $1`, [consorcioId]);
  }

  vecinosDeUnidades(unidadIds: string[]): Promise<VecinoDeUnidad[]> {
    if (unidadIds.length === 0) return Promise.resolve([]);
    return this.envios.manager.query(`${VECINOS_VIGENTES} AND un.id = ANY($1)`, [unidadIds]);
  }

  async usuario(id: string): Promise<Destinatario | null> {
    const [fila] = await this.envios.manager.query(
      'SELECT id AS "usuarioId", email, nombre FROM usuario WHERE id = $1 AND activo',
      [id],
    );
    return fila ?? null;
  }

  async totalesDeLiquidacion(liquidacionId: string): Promise<Map<string, number>> {
    const filas: { unidadId: string; total: string }[] = await this.envios.manager.query(
      'SELECT unidad_id AS "unidadId", total FROM boleta WHERE liquidacion_id = $1',
      [liquidacionId],
    );
    return new Map(filas.map((f) => [f.unidadId, Number(f.total)]));
  }

  /** El envío de un evento a una dirección, si ya hubo un intento. */
  buscarEnvio(eventoId: string, email: string): Promise<EnvioNotificacion | null> {
    return this.envios.findOneBy({ entidadTipo: 'evento', entidadId: eventoId, destinatario: email });
  }

  crearEnvio(datos: Partial<EnvioNotificacion>): Promise<EnvioNotificacion> {
    return this.envios.save(this.envios.create(datos));
  }

  async actualizarEnvio(
    id: string,
    datos: Pick<Partial<EnvioNotificacion>, 'estado' | 'intentos' | 'ultimoError' | 'enviadoAt'>,
  ): Promise<void> {
    await this.envios.update({ id }, datos);
  }
}
