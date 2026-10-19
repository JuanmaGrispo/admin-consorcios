import { Injectable, Logger } from '@nestjs/common';
import { enteroEnLetras, importeEnLetras, leerIngles, MAXIMO } from './letras';
import { NumberConversionClient } from './number-conversion.client';

/** Cuántos importes se recuerdan. Las expensas de un edificio repiten montos todo el mes. */
const TOPE_CACHE = 500;

/**
 * El importe en letras de boletas y recibos ("SON PESOS CIENTO … CON 50/100").
 *
 * Se le pregunta al servicio SOAP NumberConversion, que contesta en inglés:
 * esa respuesta se lee como número y, si coincide con el importe pedido, se
 * escribe en español. Si el servicio no contesta, contesta otra cosa o el
 * número no coincide, las letras se escriben localmente. Nunca corta la
 * generación del PDF: es cosmético (docs/producto.md).
 */
@Injectable()
export class NumerosEnLetrasService {
  private readonly logger = new Logger(NumerosEnLetrasService.name);
  /** Entero → letras en español ya verificadas con el servicio. */
  private readonly cache = new Map<number, string>();

  constructor(private readonly client: NumberConversionClient) {}

  async importe(monto: number): Promise<string> {
    const entero = Math.floor(Math.round(Math.abs(monto) * 100) / 100);
    return importeEnLetras(monto, await this.entero(entero));
  }

  /** Las letras del entero: del servicio si responde bien, locales si no. */
  private async entero(n: number): Promise<string> {
    const guardado = this.cache.get(n);
    if (guardado) return guardado;
    if (n > MAXIMO) return enteroEnLetras(MAXIMO);

    try {
      const palabras = await this.client.numeroEnPalabras(n);
      const leido = leerIngles(palabras);
      if (leido !== n) {
        this.logger.warn(`NumberConversion devolvió "${palabras}" para ${n}: se escribe localmente`);
        return enteroEnLetras(n);
      }
      const letras = enteroEnLetras(leido);
      this.recordar(n, letras);
      return letras;
    } catch (error) {
      this.logger.warn(`NumberConversion no disponible (${(error as Error).message}): se escribe localmente`);
      return enteroEnLetras(n);
    }
  }

  private recordar(n: number, letras: string) {
    // Un Map recuerda el orden de inserción: el primero es el más viejo.
    if (this.cache.size >= TOPE_CACHE) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(n, letras);
  }
}
