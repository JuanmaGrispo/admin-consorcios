import { Injectable } from '@nestjs/common';
import { PublicadorEventos } from '../mensajeria/publicador-eventos';

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
 * Los avisos personales (una reserva aprobada, un pago recibido) viajan como
 * evento `aviso.directo`: sólo lo escucha el consumidor de email, y el mail se
 * manda fuera del request, con reintentos. Los módulos de negocio siguen
 * dependiendo de `Notificador`, no del broker.
 *
 * Notificar nunca bloquea la operación principal: publicar no espera al broker
 * ni lanza.
 */
@Injectable()
export class Notificador {
  constructor(private readonly eventos: PublicadorEventos) {}

  async enviar(aviso: Aviso): Promise<void> {
    this.eventos.publicar('aviso.directo', null, {
      destinatario_id: aviso.destinatarioId,
      asunto: aviso.asunto,
      cuerpo: aviso.cuerpo,
      origen: aviso.origen,
    });
  }
}
