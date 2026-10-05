import { Injectable } from '@nestjs/common';
import { Consumidor } from '../../core/mensajeria/consumidor';
import type { EventoDomus } from '../../core/mensajeria/eventos';
import { RabbitClient } from '../../core/mensajeria/rabbit.client';
import { EmailService } from './email.service';

/** Escucha todos los eventos (`#`): cada uno termina en un mail a quien corresponda. */
@Injectable()
export class EmailNotificador extends Consumidor {
  protected readonly definicion = { cola: 'q.email-notificador', bindings: ['#'] };

  constructor(
    rabbit: RabbitClient,
    private readonly email: EmailService,
  ) {
    super(rabbit);
  }

  manejar(evento: EventoDomus): Promise<void> {
    return this.email.procesar(evento);
  }
}
