import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { UsuarioActual as Usuario } from '../auth.types';

/**
 * Inyecta el usuario del token en el handler: `@UsuarioActual() usuario`.
 * Evita que los controllers anden leyendo `request.user` a mano.
 */
export const UsuarioActual = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Usuario =>
    ctx.switchToHttp().getRequest<{ user: Usuario }>().user,
);
