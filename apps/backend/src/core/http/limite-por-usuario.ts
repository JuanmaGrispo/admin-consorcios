import {
  applyDecorators,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
  UseGuards,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

export interface Limite {
  /** Pedidos admitidos dentro de la ventana. */
  maximo: number;
  /** Largo de la ventana deslizante, en milisegundos. */
  ventanaMs: number;
}

/**
 * Límites de los endpoints costosos (criterio DIS01). Las ventanas son cortas
 * a propósito: frenan un script que repite pedidos sin trabar a una persona
 * ni a la prueba de carga, que crea un reclamo por segundo por usuario.
 */
export const LIMITES = {
  /** Alta de reclamos. */
  reclamos: { maximo: 20, ventanaMs: 10_000 },
  /** Subida de archivos: un reclamo admite hasta 5 fotos. */
  archivos: { maximo: 20, ventanaMs: 60_000 },
  /** Exportaciones a Excel (padrón, liquidación, cobranzas): arman el archivo entero. */
  exportaciones: { maximo: 10, ventanaMs: 60_000 },
  /** Recordatorios de deuda: cada pedido puede mandar miles de mails. */
  recordatorios: { maximo: 3, ventanaMs: 60_000 },
} satisfies Record<string, Limite>;

export type GrupoLimitado = keyof typeof LIMITES;

/** Pasada esta cantidad de claves, se barren las que ya no tienen pedidos en su ventana. */
const LIMPIEZA_DESDE = 10_000;

/**
 * Cuenta pedidos por clave (grupo + usuario) en una ventana deslizante. Vive
 * en memoria, como el limitador de login: con más de una instancia cada una
 * cuenta por su lado, y un reinicio lo pone en cero.
 */
export class ContadorPorUsuario {
  private readonly pedidos = new Map<string, number[]>();

  constructor(private readonly ahora: () => number = Date.now) {}

  /**
   * Registra el pedido. Devuelve `null` si entra, o los segundos que faltan
   * para que se libere un lugar si ya se llegó al máximo (y no lo cuenta).
   */
  registrar(clave: string, { maximo, ventanaMs }: Limite): number | null {
    const ahora = this.ahora();
    if (this.pedidos.size > LIMPIEZA_DESDE) this.barrer(ahora, ventanaMs);
    const vigentes = (this.pedidos.get(clave) ?? []).filter((t) => ahora - t < ventanaMs);
    if (vigentes.length >= maximo) {
      this.pedidos.set(clave, vigentes);
      return Math.max(1, Math.ceil((vigentes[0] + ventanaMs - ahora) / 1000));
    }
    vigentes.push(ahora);
    this.pedidos.set(clave, vigentes);
    return null;
  }

  private barrer(ahora: number, ventanaMs: number): void {
    for (const [clave, tiempos] of this.pedidos) {
      if (tiempos.every((t) => ahora - t >= ventanaMs)) this.pedidos.delete(clave);
    }
  }
}

const GRUPO = 'limite-por-usuario';

/** Un solo contador para toda la app: el guard se instancia por controller. */
const contadorCompartido = new ContadorPorUsuario();

/**
 * Corre después del guard de JWT (que es global), así que ya tiene al usuario.
 * Se aplica con `@LimitarPorUsuario(grupo)`.
 */
@Injectable()
export class LimitePorUsuarioGuard implements CanActivate {
  /** Compartido por todas las instancias; los tests lo reemplazan por uno con reloj propio. */
  contador: ContadorPorUsuario = contadorCompartido;

  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const grupo = this.reflector.get<GrupoLimitado | undefined>(GRUPO, contexto.getHandler());
    const usuario = contexto.switchToHttp().getRequest<Request & { user?: { id: string } }>().user;
    if (!grupo || !usuario) return true;

    const espera = this.contador.registrar(`${grupo}:${usuario.id}`, LIMITES[grupo]);
    if (espera !== null) {
      // El filtro de excepciones pasa `retryAfter` a la cabecera Retry-After.
      throw new HttpException(
        { message: `Hiciste muchos pedidos seguidos. Probá de nuevo en ${espera} s.`, retryAfter: espera },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}

/** Limita cuántas veces por ventana puede llamar cada usuario a este endpoint (429 al pasarse). */
export const LimitarPorUsuario = (grupo: GrupoLimitado) =>
  applyDecorators(SetMetadata(GRUPO, grupo), UseGuards(LimitePorUsuarioGuard));
