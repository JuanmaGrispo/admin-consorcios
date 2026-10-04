import { type EventoDomus, validarSobre } from './eventos';

export const MAX_INTENTOS = 3;

export type Decision = 'ok' | 'reintentar' | 'descartar';

/**
 * Qué hacer con un mensaje recibido. Separado del canal para poder testearlo:
 * el cliente de RabbitMQ sólo traduce la decisión a ack, reintento o DLQ.
 */
export async function despachar(
  contenido: Buffer,
  intentos: number,
  manejar: (evento: EventoDomus) => Promise<void>,
  alFallar: (error: unknown, evento: EventoDomus) => void = () => undefined,
): Promise<Decision> {
  let evento: EventoDomus | null;
  try {
    evento = validarSobre(JSON.parse(contenido.toString('utf8')));
  } catch {
    evento = null;
  }
  // Reintentar un mensaje roto no lo arregla: va directo a la DLQ.
  if (!evento) return 'descartar';

  try {
    await manejar(evento);
    return 'ok';
  } catch (error) {
    alFallar(error, evento);
    return intentos < MAX_INTENTOS ? 'reintentar' : 'descartar';
  }
}
