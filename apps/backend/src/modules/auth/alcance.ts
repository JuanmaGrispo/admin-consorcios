import { RolUsuario } from '../../database/entities';
import type { UsuarioActual } from './auth.types';

export const esGestor = (usuario: UsuarioActual) =>
  usuario.rol === RolUsuario.ADMINISTRADOR || usuario.rol === RolUsuario.SUPER_ADMIN;

/**
 * `undefined` quiere decir todos (superadmin). Un administrador sin
 * `consorcioIds` no ve nada: ante la duda, se cierra.
 */
export function consorciosGestionados(usuario: UsuarioActual): string[] | undefined {
  if (usuario.rol === RolUsuario.SUPER_ADMIN) return undefined;
  if (usuario.rol === RolUsuario.ADMINISTRADOR) return usuario.consorcioIds ?? [];
  return [];
}

export function gestiona(usuario: UsuarioActual, consorcioId: string): boolean {
  const ids = consorciosGestionados(usuario);
  return ids === undefined || ids.includes(consorcioId);
}
