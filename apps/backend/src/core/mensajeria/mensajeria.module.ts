import { Global, Module } from '@nestjs/common';
import { PublicadorEventos } from './publicador-eventos';
import { RabbitClient } from './rabbit.client';

/** Global, como notificaciones: publicar eventos es transversal. */
@Global()
@Module({
  providers: [RabbitClient, PublicadorEventos],
  exports: [RabbitClient, PublicadorEventos],
})
export class MensajeriaModule {}
