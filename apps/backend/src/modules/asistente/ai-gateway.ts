import type { UsuarioActual } from '../auth/auth.types';
import type { RespuestaAsistente, RolAsistente } from './politica';

/** Un turno anterior de la misma conversación, ya redactado. */
export interface Turno {
  pregunta: string;
  respuesta: string;
}

/** Ejecuta una herramienta de lectura con el usuario del token. */
export type EjecutarHerramienta = (nombre: string, entrada: unknown) => Promise<unknown>;

export interface ContextoPregunta {
  usuario: UsuarioActual & { rol: RolAsistente };
  /** Ya pasada por `redactarPii`. */
  pregunta: string;
  /** La ruta del front desde donde se pregunta, si es una permitida. */
  pantalla?: string;
  historial: Turno[];
  /** Qué puede ver: "Tus unidades: 3º B" o "Administrás: Torre Sur". Para que sepa qué es ajeno. */
  alcance: string;
  ejecutar: EjecutarHerramienta;
  /**
   * Si está, el adaptador va mandando el texto de la respuesta a medida que
   * llega, en pedazos. Lo que vale igual es lo que devuelve al final, validado.
   */
  onTexto?: (fragmento: string) => void;
}

export interface UsoDelModelo {
  modelo: string;
  tokensEntrada: number;
  tokensCache: number;
  tokensSalida: number;
  costoUsd: number;
}

export interface ResultadoGateway {
  /** Sin validar: el service la pasa por `validarRespuesta`. */
  respuesta: unknown;
  /** Las herramientas que se llamaron, en orden. */
  herramientas: string[];
  uso?: UsoDelModelo;
  /** El modelo se negó a responder (`stop_reason: "refusal"`). */
  rechazada?: boolean;
}

/**
 * Lo único que el service sabe del proveedor de IA. El adaptador de OpenAI
 * lo implementa y en los tests se reemplaza por uno falso: cambiar de modelo
 * o de proveedor no toca el resto del módulo.
 */
export interface AIGateway {
  /** False si no está configurado (sin API key): el service ni lo intenta. */
  readonly disponible: boolean;
  responder(contexto: ContextoPregunta): Promise<ResultadoGateway>;
}

export const AI_GATEWAY = Symbol('AI_GATEWAY');

/** Una falla del proveedor que manda la pregunta al manual. */
export class FallaDelModelo extends Error {
  constructor(
    readonly motivo: 'timeout' | 'json_invalido' | 'max_tokens' | 'proveedor',
    readonly uso?: UsoDelModelo,
    readonly herramientas: string[] = [],
  ) {
    super(`Falla del modelo: ${motivo}`);
  }
}

export type { RespuestaAsistente };
