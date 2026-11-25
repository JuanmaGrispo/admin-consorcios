import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { RolUsuario, Usuario } from '../../database/entities';
import { AuthRepository } from './auth.repository';
import type { JwtPayload, UsuarioActual } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { coincideHuella, huellaPassword } from './huella-sesion';
import { LimitadorLogin } from './limitador-login';
import { BCRYPT_ROUNDS } from './password';

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
    private readonly limitador: LimitadorLogin,
  ) {}

  async login(dto: LoginDto, ip?: string): Promise<SesionIniciada> {
    this.limitador.exigirHabilitado(dto.email, ip);
    const usuario = await this.usuarios.findByEmail(dto.email);

    // Siempre se corre un bcrypt, exista el usuario o no (ver HASH_DUMMY).
    const coincide = await bcrypt.compare(
      dto.password,
      usuario?.passwordHash ?? HASH_DUMMY,
    );

    // Un solo mensaje para credenciales malas, usuario inexistente y usuario
    // dado de baja: decir cuál de los tres es sirve para enumerar cuentas.
    if (!usuario || !coincide || !usuario.activo) {
      this.limitador.registrarFallo(dto.email, ip);
      throw new UnauthorizedException('Email o contraseña incorrectos');
    }
    this.limitador.registrarExito(dto.email);

    return {
      accessToken: await this.firmarToken(usuario),
      usuario: await this.aUsuarioActual(usuario),
    };
  }

  /**
   * Relee el usuario en cada request autenticado, en vez de confiar en lo que
   * dice el token: si lo dieron de baja o le cambiaron el rol, el cambio pega
   * al instante y no cuando venza el token. Lo mismo con los consorcios de un
   * administrador: reasignarle uno le cambia el alcance en el próximo request.
   *
   * También compara la huella de la contraseña: si cambió después de firmar
   * el token, la sesión ya no vale (AUT10).
   */
  async validarPayload(payload: JwtPayload): Promise<UsuarioActual> {
    const usuario = await this.usuarios.findParaSesion(payload.sub);
    if (!usuario || !usuario.activo || !coincideHuella(payload.pwd, usuario.passwordHash)) {
      throw new UnauthorizedException('La sesión ya no es válida');
    }
    return this.aUsuarioActual(usuario);
  }

  /**
   * Token nuevo para quien acaba de cambiar su contraseña: sus otras sesiones
   * quedan cortadas, pero la del pedido que hizo el cambio sigue.
   */
  async renovarSesion(usuarioId: string): Promise<string> {
    const usuario = await this.usuarios.findParaSesion(usuarioId);
    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('La sesión ya no es válida');
    }
    return this.firmarToken(usuario);
  }

  private firmarToken(usuario: Usuario): Promise<string> {
    const payload: JwtPayload = {
      sub: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      pwd: huellaPassword(usuario.passwordHash),
    };
    return this.jwt.signAsync(payload);
  }

  /** Recorta la entidad a lo que puede salir por la API: nunca el hash. */
  private async aUsuarioActual(
    usuario: Usuario,
  ): Promise<UsuarioActual & { nombre: string; apellido: string }> {
    return {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      ...(usuario.rol === RolUsuario.ADMINISTRADOR && {
        consorcioIds: await this.usuarios.consorciosAdministrados(usuario.id),
      }),
    };
  }
}
