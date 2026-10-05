import { Injectable } from '@nestjs/common';
import { Consumidor } from '../../core/mensajeria/consumidor';
import type { EventoDomus } from '../../core/mensajeria/eventos';
import { RabbitClient } from '../../core/mensajeria/rabbit.client';
import { EVENTOS_DEL_MURO } from './muro';
import { NovedadesService } from './novedades.service';

/**
 * MuroNovedadesPublicador: sólo los eventos que son del edificio. Un reclamo
 * cerrado es información de un vecino, no una novedad de todos.
 */
@Injectable()
export class MuroNovedadesPublicador extends Consumidor {
  protected readonly definicion = {
    cola: 'q.muro-novedades-publicador',
    bindings: [...EVENTOS_DEL_MURO],
  };

  constructor(
    rabbit: RabbitClient,
    private readonly novedades: NovedadesService,
  ) {
    super(rabbit);
  }

  manejar(evento: EventoDomus): Promise<void> {
    return this.novedades.publicarAutomatica(evento);
  }
}
