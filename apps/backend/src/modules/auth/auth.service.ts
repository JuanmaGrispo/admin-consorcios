import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Usuario } from '../../database/entities';
import { AuthRepository } from './auth.repository';
import type { JwtPayload, UsuarioActual } from './auth.types';
import { LoginDto } from './dto/login.dto';

/** Costo del hash. 10 rondas es el default de bcrypt y va bien acá. */
export const BCRYPT_ROUNDS = 10;

/**
 * Hash descartable con el que se compara cuando el email no existe. Sin esto,
 * un email inexistente responde mucho más rápido que uno real —la diferencia
 * es el bcrypt que no se corre— y eso permite averiguar qué usuarios existen
 * midiendo tiempos.
 */
const HASH_DUMMY = bcrypt.hashSync('usuario-inexistente', BCRYPT_ROUNDS);

/** Lo que devuelve un login exitoso. */
export interface SesionIniciada {
  accessToken: string;
  usuario: UsuarioActual & { nombre: string; apellido: string };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usuarios: AuthRepository,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<SesionIniciada> {
    const usuario = await this.usuarios.findByEmail(dto.email);

    // Siempre se corre un bcrypt, exista el usuario o no (ver HASH_DUMMY).
    const coincide = await bcrypt.compare(
      dto.password,
      usuario?.passwordHash ?? HASH_DUMMY,
    );

    // Un solo mensaje para credenciales malas, usuario inexistente y usuario
    // dado de baja: decir cuál de los tres es sirve para enumerar cuentas.
    if (!usuario || !coincide || !usuario.activo) {
      throw new UnauthorizedException('Email o contraseña incorrectos');
    }

    return {
      accessToken: await this.firmarToken(usuario),
      usuario: this.aUsuarioActual(usuario),
    };
  }

  /**
   * Relee el usuario en cada request autenticado, en vez de confiar en lo que
   * dice el token: si lo dieron de baja o le cambiaron el rol, el cambio pega
   * al instante y no cuando venza el token.
   */
  async validarPayload(payload: JwtPayload): Promise<UsuarioActual> {
    const usuario = await this.usuarios.findById(payload.sub);
    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('La sesión ya no es válida');
    }
    return this.aUsuarioActual(usuario);
  }

  private firmarToken(usuario: Usuario): Promise<string> {
    const payload: JwtPayload = {
      sub: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
    };
    return this.jwt.signAsync(payload);
  }

  /** Recorta la entidad a lo que puede salir por la API: nunca el hash. */
  private aUsuarioActual(
    usuario: Usuario,
  ): UsuarioActual & { nombre: string; apellido: string } {
    return {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
    };
  }
}
