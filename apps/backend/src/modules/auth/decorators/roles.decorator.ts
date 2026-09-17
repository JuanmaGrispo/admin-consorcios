import { SetMetadata } from '@nestjs/common';
import type { RolUsuario } from '../../../database/entities';

export const ROLES = 'roles';

/** Restringe una ruta a los roles indicados. Sin esto, alcanza con estar logueado. */
export const Roles = (...roles: RolUsuario[]) => SetMetadata(ROLES, roles);
