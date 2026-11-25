import type { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { COOKIE_MAX_AGE_MS, COOKIE_SESION } from './auth.constants';

/**
 * Deja el JWT en la cookie httpOnly de sesión. La usan el login y el cambio
 * de contraseña, que emite un token nuevo para la sesión que lo pidió.
 */
export function ponerCookieSesion(res: Response, token: string, config: Pick<ConfigService, 'get'>): void {
  res.cookie(COOKIE_SESION, token, {
    httpOnly: true,
    sameSite: 'lax',
    // En prod la cookie solo viaja por HTTPS. En dev (http://localhost) no
    // puede ser secure o el navegador la descarta.
    secure: config.get('NODE_ENV') === 'production',
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/',
  });
}
