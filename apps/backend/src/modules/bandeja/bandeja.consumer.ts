import { Injectable } from '@nestjs/common';
import { Consumidor } from '../../core/mensajeria/consumidor';
import type { EventoDomus } from '../../core/mensajeria/eventos';
import { RabbitClient } from '../../core/mensajeria/rabbit.client';
import { BandejaService } from './bandeja.service';

/** Escucha todo, como el mail: cada evento deja su aviso en la bandeja de quien corresponda. */
@Injectable()
export class BandejaNotificaciones extends Consumidor {
  protected readonly definicion = { cola: 'q.bandeja-notificaciones', bindings: ['#'] };

  constructor(
    rabbit: RabbitClient,
    private readonly bandeja: BandejaService,
  ) {
    super(rabbit);
  }

  manejar(evento: EventoDomus): Promise<void> {
    return this.bandeja.procesar(evento);
  }
}
