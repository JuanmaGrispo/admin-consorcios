import type { Channel } from 'amqplib';

export const EXCHANGE = 'domus.eventos';
export const EXCHANGE_DLX = 'domus.eventos.dlx';

/** Cuánto espera un mensaje fallido antes de volver a la cola. */
export const ESPERA_REINTENTO_MS = 30_000;

export interface DefinicionCola {
  cola: string;
  /** Routing keys que escucha. `#` es todos. */
  bindings: string[];
}

export const colaDeReintento = (cola: string) => `${cola}.reintento`;
export const colaMuerta = (cola: string) => `${cola}.dlq`;

export async function declararExchanges(canal: Channel): Promise<void> {
  await canal.assertExchange(EXCHANGE, 'topic', { durable: true });
  await canal.assertExchange(EXCHANGE_DLX, 'direct', { durable: true });
}

/**
 * Tres colas por consumidor:
 *
 *   cola            la que escucha; lo rechazado va al DLX
 *   cola.reintento  sin consumidor: el TTL la devuelve a `cola` a los 30 s
 *   cola.dlq        lo que agotó los reintentos o vino roto, para mirarlo a mano
 *
 * Declarar es idempotente: cada arranque (y cada reconexión) vuelve a asegurarlo.
 */
export async function declararCola(canal: Channel, { cola, bindings }: DefinicionCola): Promise<void> {
  await declararExchanges(canal);
  await canal.assertQueue(cola, {
    durable: true,
    deadLetterExchange: EXCHANGE_DLX,
    deadLetterRoutingKey: cola,
  });
  await canal.assertQueue(colaDeReintento(cola), {
    durable: true,
    messageTtl: ESPERA_REINTENTO_MS,
    deadLetterExchange: '',
    deadLetterRoutingKey: cola,
  });
  await canal.assertQueue(colaMuerta(cola), { durable: true });
  await canal.bindQueue(colaMuerta(cola), EXCHANGE_DLX, cola);
  for (const binding of bindings) await canal.bindQueue(cola, EXCHANGE, binding);
}
