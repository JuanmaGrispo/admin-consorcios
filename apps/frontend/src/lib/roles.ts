import type { RolUsuario } from '@/types/usuario';

/**
 * A dónde va cada rol al entrar: el superadmin al panel de la plataforma, el
 * administrador a su portal y el vecino al suyo. El login y los layouts lo
 * usan para mandar a cada uno a su lugar.
 */
export function inicioDe(rol: RolUsuario): string {
  switch (rol) {
    case 'SUPER_ADMIN':
      return '/';
    case 'ADMINISTRADOR':
      return '/admin';
    case 'VECINO':
      return '/vecino';
  }
}
