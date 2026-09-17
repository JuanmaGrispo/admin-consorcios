import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from './auth.service';
import type { JwtPayload, UsuarioActual } from './auth.types';

/**
 * Valida el token del header `Authorization: Bearer <token>`. Lo que devuelve
 * `validate` es lo que Passport cuelga en `request.user`.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly auth: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // Un token vencido se rechaza: nunca se ignora la expiración.
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  validate(payload: JwtPayload): Promise<UsuarioActual> {
    return this.auth.validarPayload(payload);
  }
}
