import { NextResponse, type NextRequest } from 'next/server';

/**
 * Guard de rutas por presencia de cookie. La cookie es httpOnly y la setea el
 * backend en localhost, así que este server también la recibe. Acá solo se
 * mira si EXISTE — validarla (firma, expiración, rol) es trabajo del backend
 * en cada request; si está vencida, la primera llamada da 401 y el cliente
 * te devuelve al login.
 */
const COOKIE_SESION = 'domus_session';

export default function proxy(request: NextRequest) {
  const tieneSesion = request.cookies.has(COOKIE_SESION);
  const esLogin = request.nextUrl.pathname === '/login';

  if (!tieneSesion && !esLogin) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (tieneSesion && esLogin) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Todo salvo assets y archivos estáticos.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.).*)'],
};
