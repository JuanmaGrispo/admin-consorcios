import { Global, Module } from '@nestjs/common';
import { PublicadorEventos } from './publicador-eventos';
import { RabbitClient } from './rabbit.client';
import { OutboxRepository } from './outbox.repository';

/** Global, como notificaciones: publicar eventos es transversal. */
@Global()
@Module({
  providers: [OutboxRepository, RabbitClient, PublicadorEventos],
  exports: [RabbitClient, PublicadorEventos],
})
export class MensajeriaModule {}
