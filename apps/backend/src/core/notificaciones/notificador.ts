import { Injectable, Logger } from '@nestjs/common';

/** Un aviso a una persona, sin decir por qué canal sale. */
export interface Aviso {
  /** A quién va dirigido. */
  destinatarioId: string;
  asunto: string;
  cuerpo: string;
  /** Para rastrear de dónde salió: `reclamo:<id>`, `boleta:<id>`, etc. */
  origen: string;
}

/**
 * Punto de extensión para los avisos. Hoy sólo deja registro en el log.
 *
 * El módulo de notificaciones —que tiene sus propias tablas (`notificacion`,
 * `envio_notificacion`, `preferencia_notificacion`)— va a implementar esta
 * misma interfaz con NodeMailer detrás. Los módulos de negocio dependen de
 * `Notificador`, no de SMTP, así que ese día no hay que tocarlos.
 *
 * Regla del alcance: notificar nunca bloquea la operación principal. Si el
 * aviso falla, la respuesta al reclamo ya quedó guardada igual.
 */
@Injectable()
export class Notificador {
  private readonly logger = new Logger(Notificador.name);

  async enviar(aviso: Aviso): Promise<void> {
    this.logger.log(
      `[pendiente de envío] ${aviso.origen} → usuario ${aviso.destinatarioId}: ${aviso.asunto}`,
    );
    return Promise.resolve();
  }
}
