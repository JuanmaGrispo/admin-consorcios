import { Injectable, Logger } from '@nestjs/common';
import { crearSobre, type PayloadsEventos, type TipoEvento, validarSobre } from './eventos';
import { RabbitClient } from './rabbit.client';

/**
 * Lo único que ven los services: publicar un evento sin saber quién lo
 * escucha. Espera la persistencia del pendiente; no la disponibilidad del
 * broker. Un error de base se propaga y no se oculta como publicación exitosa.
 */
@Injectable()
export class PublicadorEventos {
  private readonly logger = new Logger(PublicadorEventos.name);

  constructor(private readonly rabbit: RabbitClient) {}

  async publicar<T extends TipoEvento>(
    tipo: T,
    consorcioId: string | null,
    payload: PayloadsEventos[T],
  ): Promise<void> {
    const sobre = crearSobre(tipo, consorcioId, payload);
    if (!validarSobre(sobre)) {
      throw new Error(`Evento ${tipo} incompleto`);
    }
    if (!this.rabbit.configurado) {
      this.logger.log(`Evento ${tipo} pendiente de configurar RabbitMQ`);
    }

    await this.rabbit.publicar(tipo, Buffer.from(JSON.stringify(sobre)), sobre.evento_id);
  }
}
