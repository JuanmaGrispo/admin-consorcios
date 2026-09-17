import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { COOKIE_MAX_AGE_MS, COOKIE_SESION } from './auth.constants';
import { AuthService, type SesionIniciada } from './auth.service';
import type { UsuarioActual as Usuario } from './auth.types';
import { Public } from './decorators/public.decorator';
import { UsuarioActual } from './decorators/usuario-actual.decorator';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('login')
  // 200 y no 201: iniciar sesión no crea un recurso.
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inicia sesión: deja el JWT en una cookie httpOnly' })
  @ApiResponse({ status: 200, description: 'Cookie de sesión y datos del usuario' })
  @ApiResponse({ status: 401, description: 'Email o contraseña incorrectos' })
  async login(
    @Body() dto: LoginDto,
    // passthrough: Nest sigue serializando el return; res es solo para la cookie.
    @Res({ passthrough: true }) res: Response,
  ): Promise<SesionIniciada> {
    const sesion = await this.auth.login(dto);

    res.cookie(COOKIE_SESION, sesion.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      // En prod la cookie solo viaja por HTTPS. En dev (http://localhost) no
      // puede ser secure o el navegador la descarta.
      secure: this.config.get('NODE_ENV') === 'production',
      maxAge: COOKIE_MAX_AGE_MS,
      path: '/',
    });

    // El token también va en el body para Swagger, scripts y clientes que no
    // usan cookies. El frontend web lo ignora: su sesión es la cookie.
    return sesion;
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  // Público a propósito: cerrar sesión con un token ya vencido tiene que
  // funcionar igual — lo único que hace es borrar la cookie.
  @ApiOperation({ summary: 'Cierra la sesión borrando la cookie' })
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(COOKIE_SESION, { path: '/' });
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Devuelve el usuario de la sesión (cookie o bearer)' })
  @ApiResponse({ status: 401, description: 'Falta la sesión o no es válida' })
  me(@UsuarioActual() usuario: Usuario): Usuario {
    return usuario;
  }
}
