import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Huella de la contraseña vigente que viaja dentro del JWT (claim `pwd`).
 *
 * Al validar cada pedido se compara contra la huella del hash actual: si la
 * contraseña cambió —la cambió el usuario o se la reseteó un administrador—,
 * las sesiones abiertas antes del cambio dejan de valer y responden 401
 * (criterio AUT10). No hace falta una columna nueva: el hash bcrypt ya cambia
 * con cada contraseña, porque lleva sal propia.
 *
 * Es un SHA-256 del hash, recortado: no sirve para atacar la contraseña y no
 * expone el hash, que sigue sin salir de la base.
 */
export function huellaPassword(passwordHash: string): string {
  return createHash('sha256').update(passwordHash).digest('base64url').slice(0, 22);
}

/** Si la huella del token corresponde a la contraseña vigente. */
export function coincideHuella(huella: unknown, passwordHash: string | undefined): boolean {
  if (typeof huella !== 'string' || !passwordHash) return false;
  const recibida = Buffer.from(huella);
  const vigente = Buffer.from(huellaPassword(passwordHash));
  return recibida.length === vigente.length && timingSafeEqual(recibida, vigente);
}
