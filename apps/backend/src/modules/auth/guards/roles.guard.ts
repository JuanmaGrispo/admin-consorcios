import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RolUsuario } from '../../../database/entities';
import type { UsuarioActual } from '../auth.types';
import { IS_PUBLIC } from '../decorators/public.decorator';
import { ROLES } from '../decorators/roles.decorator';

/**
 * Corre después del guard de JWT: para entonces el usuario ya está en el
 * request. Sin @Roles() en la ruta, alcanza con estar autenticado.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const esPublica = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (esPublica) return true;

    const permitidos = this.reflector.getAllAndOverride<RolUsuario[]>(ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permitidos?.length) return true;

    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: UsuarioActual }>();

    if (!user || !permitidos.includes(user.rol)) {
      throw new ForbiddenException('No tenés permiso para esta operación');
    }
    return true;
  }
}
