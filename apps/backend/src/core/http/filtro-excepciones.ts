import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';

/** Sin saltos de línea ni caracteres de control: un dato del cliente no puede falsificar una línea del log. */
export const limpiarParaLog = (valor: unknown): string =>
  // eslint-disable-next-line no-control-regex
  String(valor ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').slice(0, 200);

interface CapaExpress {
  route?: { methods?: Record<string, boolean> };
  matchers?: Array<(path: string) => unknown>;
}

/**
 * Los métodos que sí existen para esa ruta. Se lee la tabla de rutas de
 * Express: Nest responde 404 a un método no previsto, y lo correcto es 405.
 */
export function metodosDeRuta(req: Request): string[] {
  const capas: CapaExpress[] = (req.app as unknown as { router?: { stack?: CapaExpress[] } }).router?.stack ?? [];
  const metodos = new Set<string>();
  for (const capa of capas) {
    if (!capa.route?.methods || !capa.matchers?.some((m) => m(req.path))) continue;
    for (const [metodo, activo] of Object.entries(capa.route.methods)) {
      if (activo && metodo !== '_all') metodos.add(metodo.toUpperCase());
    }
  }
  return [...metodos];
}

/**
 * Un solo lugar para lo que sale por error:
 *  - método no previsto → 405 con `Allow`;
 *  - error no controlado → 500 genérico con un id de correlación (el detalle va
 *    al log con ese mismo id, nunca al cliente);
 *  - 401 y 403 → quedan en el log con fecha, IP y usuario.
 */
@Catch()
export class FiltroExcepciones implements ExceptionFilter {
  private readonly logger = new Logger('Http');

  catch(excepcion: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request & { user?: { id?: string } }>();
    const res = http.getResponse<Response>();

    if (excepcion instanceof HttpException) {
      const status = excepcion.getStatus();

      if (excepcion instanceof NotFoundException && req.method !== 'HEAD') {
        const permitidos = metodosDeRuta(req);
        if (permitidos.length && !permitidos.includes(req.method)) {
          res.setHeader('Allow', permitidos.join(', '));
          res.status(HttpStatus.METHOD_NOT_ALLOWED).json({
            statusCode: HttpStatus.METHOD_NOT_ALLOWED,
            message: `Método ${req.method} no permitido`,
            error: 'Method Not Allowed',
          });
          return;
        }
      }

      if (status === HttpStatus.UNAUTHORIZED || status === HttpStatus.FORBIDDEN) {
        this.logger.warn(
          `${status} ${limpiarParaLog(req.method)} ${limpiarParaLog(req.originalUrl)} ip=${limpiarParaLog(req.ip)} usuario=${limpiarParaLog(req.user?.id ?? 'anónimo')}`,
        );
      }
      res.status(status).json(excepcion.getResponse());
      return;
    }

    const id = randomUUID();
    this.logger.error(
      `500 ${limpiarParaLog(req.method)} ${limpiarParaLog(req.originalUrl)} id=${id}`,
      excepcion instanceof Error ? excepcion.stack : String(excepcion),
    );
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Error interno del servidor',
      id,
    });
  }
}
