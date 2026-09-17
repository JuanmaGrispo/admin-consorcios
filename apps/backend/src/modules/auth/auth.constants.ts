/**
 * Nombre de la cookie httpOnly donde viaja el JWT. El navegador la manda solo,
 * el JS del frontend no puede leerla, y el backend la borra en el logout.
 */
export const COOKIE_SESION = 'domus_session';

/** Vida de la cookie. Alineada con JWT_EXPIRES_IN=1d: vencen juntos. */
export const COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
