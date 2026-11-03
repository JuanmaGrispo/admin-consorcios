import { ServiceUnavailableException } from '@nestjs/common';

/** Un solo intento: una escritura externa con resultado incierto no se repite. */
export async function llamarProveedor<T>(operacion: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const signal = AbortSignal.timeout(5000);
  try {
    return await operacion(signal);
  } catch (error) {
    if (signal.aborted || error instanceof TypeError) {
      throw new ServiceUnavailableException('El servicio externo no está disponible. Probá de nuevo en un rato.');
    }
    throw error;
  }
}
