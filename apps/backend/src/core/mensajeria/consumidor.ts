import { OnApplicationBootstrap } from '@nestjs/common';
import type { EventoDomus } from './eventos';
import type { RabbitClient } from './rabbit.client';
import type { DefinicionCola } from './topologia';

/**
 * Base de los consumidores: declaran su cola y sus bindings, y delegan cada
 * evento en un service. Nada de SQL ni SMTP en el handler.
 */
export abstract class Consumidor implements OnApplicationBootstrap {
  protected abstract readonly definicion: DefinicionCola;

  protected constructor(private readonly rabbit: RabbitClient) {}

  abstract manejar(evento: EventoDomus): Promise<void>;

  async onApplicationBootstrap(): Promise<void> {
    await this.rabbit.consumir(this.definicion, (evento) => this.manejar(evento));
  }
}
