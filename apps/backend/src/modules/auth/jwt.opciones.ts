import type { ConfigService } from '@nestjs/config';
import type { JwtModuleOptions, JwtSignOptions } from '@nestjs/jwt';

/**
 * Único algoritmo admitido. Fijarlo evita aceptar `alg: none` o un token
 * firmado con otro algoritmo aunque la librería cambie su comportamiento por
 * defecto (OWASP ASVS 9.1 / API2:2023).
 */
export const JWT_ALGORITMO = 'HS256' as const;

/** Emisor (`iss`) que firma y exige el backend. Un token de otro emisor es 401. */
export function emisorJwt(config: Pick<ConfigService, 'get'>): string {
  return config.get<string>('JWT_ISSUER') || 'domus';
}

/** Opciones del JwtModule: firma y verificación con el mismo algoritmo y emisor. */
export function opcionesJwt(config: Pick<ConfigService, 'get' | 'getOrThrow'>): JwtModuleOptions {
  const issuer = emisorJwt(config);
  return {
    // getOrThrow: sin secreto la app no arranca. Un default acá sería un
    // secreto conocido en producción.
    secret: config.getOrThrow<string>('JWT_SECRET'),
    // El cast es por el tipo de `expiresIn`, que jsonwebtoken declara como
    // un literal (`'1d' | '2h' | …`) y acá sale de una variable de entorno.
    signOptions: {
      expiresIn: config.get<string>('JWT_EXPIRES_IN', '1d'),
      algorithm: JWT_ALGORITMO,
      issuer,
    } as JwtSignOptions,
    verifyOptions: { algorithms: [JWT_ALGORITMO], issuer },
  };
}
