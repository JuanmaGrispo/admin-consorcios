import type { RolUsuario } from '../../database/entities';

/** Lo que viaja firmado dentro del JWT. */
export interface JwtPayload {
  /** id del usuario (claim estándar `subject`). */
  sub: string;
  email: string;
  rol: RolUsuario;
  /** Huella de la contraseña vigente al firmar (ver huella-sesion.ts). */
  pwd: string;
}

/** Lo que el guard deja colgado del request una vez validado el token. */
export interface UsuarioActual {
  id: string;
  email: string;
  rol: RolUsuario;
  /** Sólo para ADMINISTRADOR: los consorcios que tiene asignados. */
  consorcioIds?: string[];
}
