import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { politicaCsp } from '@/lib/csp';

/**
 * Guard de rutas por presencia de cookie. La cookie es httpOnly y la setea el
 * backend en localhost, así que este server también la recibe. Acá solo se
 * mira si EXISTE — validarla (firma, expiración, rol) es trabajo del backend
 * en cada request; si está vencida, la primera llamada da 401 y el cliente
 * te devuelve al login.
 */
const COOKIE_SESION = 'domus_session';

export default function proxy(request: NextRequest) {
  const nonce = randomBytes(16).toString('base64');
  const csp = politicaCsp(nonce);
  const headers = new Headers(request.headers);
  // Se sobreescriben los valores de entrada: el cliente no elige el nonce.
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  const tieneSesion = request.cookies.has(COOKIE_SESION);
  const esLogin = request.nextUrl.pathname === '/login';

  const response = !tieneSesion && !esLogin
    ? NextResponse.redirect(new URL('/login', request.url))
    : tieneSesion && esLogin
      ? NextResponse.redirect(new URL('/', request.url))
      : NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = {
  // Todo salvo assets y archivos estáticos.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|logo-domus.png|login-paisaje.jpg).*)'],
};
