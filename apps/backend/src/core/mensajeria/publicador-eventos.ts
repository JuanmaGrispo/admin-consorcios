import { Injectable, Logger } from '@nestjs/common';
import { crearSobre, type PayloadsEventos, type TipoEvento, validarSobre } from './eventos';
import { RabbitClient } from './rabbit.client';

/**
 * Lo único que ven los services: publicar un evento sin saber quién lo
 * escucha. No espera la confirmación del broker ni lanza nunca — avisar no
 * puede cortar ni demorar la operación que lo originó.
 */
@Injectable()
export class PublicadorEventos {
  private readonly logger = new Logger(PublicadorEventos.name);

  constructor(private readonly rabbit: RabbitClient) {}

  publicar<T extends TipoEvento>(
    tipo: T,
    consorcioId: string | null,
    payload: PayloadsEventos[T],
  ): void {
    const sobre = crearSobre(tipo, consorcioId, payload);
    if (!validarSobre(sobre)) {
      this.logger.error(`Evento ${tipo} incompleto, no se publica: ${JSON.stringify(payload)}`);
      return;
    }
    if (!this.rabbit.configurado) {
      this.logger.log(`[evento sin publicar] ${tipo} ${JSON.stringify(payload)}`);
      return;
    }

    this.rabbit
      .publicar(tipo, Buffer.from(JSON.stringify(sobre)), sobre.evento_id)
      .catch((error: unknown) =>
        this.logger.error(
          `No se pudo publicar ${tipo} ${sobre.evento_id}: ${error instanceof Error ? error.message : error}`,
        ),
      );
  }
}
