import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Channel, ConsumeMessage } from 'amqplib';
import {
  type AmqpConnectionManager,
  type ChannelWrapper,
  connect,
} from 'amqp-connection-manager';
import { despachar } from './despacho';
import type { EventoDomus } from './eventos';
import {
  colaDeReintento,
  declararCola,
  declararExchanges,
  type DefinicionCola,
  EXCHANGE,
} from './topologia';

/**
 * La conexión con RabbitMQ. Sin `RABBITMQ_URL` no conecta y la app anda igual:
 * los eventos quedan en el log, como con Mercado Pago o archivos sin configurar.
 *
 * amqp-connection-manager reconecta solo y retiene en memoria lo que se publica
 * mientras el broker está caído.
 */
@Injectable()
export class RabbitClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitClient.name);
  private conexion: AmqpConnectionManager | null = null;
  private publicacion: ChannelWrapper | null = null;
  private readonly canales: ChannelWrapper[] = [];

  constructor(private readonly config: ConfigService) {}

  get configurado(): boolean {
    return Boolean(this.config.get<string>('RABBITMQ_URL'));
  }

  onModuleInit(): void {
    const url = this.config.get<string>('RABBITMQ_URL');
    if (!url) {
      this.logger.warn('Sin RABBITMQ_URL: los eventos no se publican, sólo se loguean');
      return;
    }
    this.conexion = connect([url]);
    this.conexion.on('connect', () => this.logger.log('Conectado a RabbitMQ'));
    this.conexion.on('disconnect', ({ err }) =>
      this.logger.warn(`Se cortó RabbitMQ: ${err?.message ?? 'sin detalle'}`),
    );
    this.publicacion = this.conexion.createChannel({
      confirm: true,
      setup: (canal: Channel) => declararExchanges(canal),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([...this.canales, this.publicacion].map((c) => c?.close()));
    await this.conexion?.close();
  }

  /** Persistente: sobrevive a un reinicio del broker. */
  publicar(routingKey: string, contenido: Buffer, messageId: string): Promise<boolean> {
    if (!this.publicacion) return Promise.resolve(false);
    return this.publicacion.publish(EXCHANGE, routingKey, contenido, {
      contentType: 'application/json',
      persistent: true,
      messageId,
    });
  }

  /**
   * Ack manual: el mensaje se confirma recién después de procesarlo. Si el
   * handler falla vuelve por la cola de reintento; agotados los intentos, a la
   * DLQ con un nack sin requeue.
   */
  async consumir(
    definicion: DefinicionCola,
    manejar: (evento: EventoDomus) => Promise<void>,
  ): Promise<void> {
    if (!this.conexion) return;
    const canal = this.conexion.createChannel({
      setup: (ch: Channel) => declararCola(ch, definicion),
    });
    this.canales.push(canal);

    await canal.consume(
      definicion.cola,
      async (mensaje: ConsumeMessage) => {
        const intentos = Number(mensaje.properties.headers?.['x-intentos'] ?? 0);
        const decision = await despachar(mensaje.content, intentos, manejar, (error, evento) =>
          this.logger.error(
            `${definicion.cola} falló con ${evento.tipo_evento} ${evento.evento_id} (intento ${intentos + 1}): ${
              error instanceof Error ? error.message : String(error)
            }`,
          ),
        );

        if (decision === 'descartar') return canal.nack(mensaje, false, false);
        if (decision === 'reintentar') {
          await canal.sendToQueue(colaDeReintento(definicion.cola), mensaje.content, {
            contentType: 'application/json',
            persistent: true,
            messageId: mensaje.properties.messageId,
            headers: { 'x-intentos': intentos + 1 },
          });
        }
        canal.ack(mensaje);
      },
      { noAck: false, prefetch: 10 },
    );
    this.logger.log(`Escuchando ${definicion.cola} (${definicion.bindings.join(', ')})`);
  }
}
