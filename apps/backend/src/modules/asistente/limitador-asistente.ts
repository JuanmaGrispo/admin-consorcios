import { HttpException, HttpStatus } from '@nestjs/common';

export const MAX_POR_MINUTO = 10;
export const MAX_POR_DIA = 100;
const MINUTO_MS = 60_000;
const DIA_MS = 24 * 60 * MINUTO_MS;

/** Pasada esta cantidad de usuarios, se barren los que no preguntaron en el día. */
const LIMPIEZA_DESDE = 10_000;

/**
 * Cuántas preguntas puede hacer cada usuario: 10 por minuto y 100 por día.
 * Corta el abuso y el gasto de un usuario solo antes de que lo note el tope
 * diario de toda la plataforma.
 *
 * Vive en memoria, como el limitador de login: con más de una instancia cada
 * una cuenta por su lado, y un reinicio lo pone en cero.
 */
export class LimitadorAsistente {
  private readonly preguntas = new Map<string, number[]>();

  constructor(private readonly ahora: () => number = Date.now) {}

  /** Cuenta la pregunta o tira 429 si se pasó. */
  registrar(usuarioId: string): void {
    const ahora = this.ahora();
    if (this.preguntas.size > LIMPIEZA_DESDE) this.barrer(ahora);
    const delDia = (this.preguntas.get(usuarioId) ?? []).filter((t) => ahora - t < DIA_MS);
    if (delDia.length >= MAX_POR_DIA) {
      this.preguntas.set(usuarioId, delDia);
      throw new HttpException(
        'Llegaste al máximo de preguntas al asistente por hoy. Probá de nuevo mañana.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (delDia.filter((t) => ahora - t < MINUTO_MS).length >= MAX_POR_MINUTO) {
      this.preguntas.set(usuarioId, delDia);
      throw new HttpException(
        'Hiciste muchas preguntas seguidas. Esperá un minuto y probá de nuevo.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    delDia.push(ahora);
    this.preguntas.set(usuarioId, delDia);
  }

  private barrer(ahora: number): void {
    for (const [usuario, tiempos] of this.preguntas) {
      if (tiempos.every((t) => ahora - t >= DIA_MS)) this.preguntas.delete(usuario);
    }
  }
}
