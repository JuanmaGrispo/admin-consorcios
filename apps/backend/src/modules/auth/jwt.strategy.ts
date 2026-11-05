import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { COOKIE_SESION } from './auth.constants';
import { AuthService } from './auth.service';
import type { JwtPayload, UsuarioActual } from './auth.types';
import { emisorJwt, JWT_ALGORITMO } from './jwt.opciones';

/**
 * Valida el JWT buscándolo en dos lugares, en orden:
 *
 *   1. La cookie httpOnly `domus_session` — el camino del frontend web.
 *   2. El header `Authorization: Bearer <token>` — Swagger, scripts, mobile.
 *
 * Lo que devuelve `validate` es lo que Passport cuelga en `request.user`.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly auth: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req.cookies?.[COOKIE_SESION] ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      // Un token vencido se rechaza: nunca se ignora la expiración.
      ignoreExpiration: false,
      // Sólo HS256 y sólo nuestro emisor: alg=none, otro algoritmo u otro iss → 401.
      algorithms: [JWT_ALGORITMO],
      issuer: emisorJwt(config),
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  validate(payload: JwtPayload): Promise<UsuarioActual> {
    return this.auth.validarPayload(payload);
  }
}
