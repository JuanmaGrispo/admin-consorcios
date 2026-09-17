import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService, type SesionIniciada } from './auth.service';
import type { UsuarioActual as Usuario } from './auth.types';
import { Public } from './decorators/public.decorator';
import { UsuarioActual } from './decorators/usuario-actual.decorator';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  // 200 y no 201: iniciar sesión no crea un recurso.
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inicia sesión y devuelve un JWT' })
  @ApiResponse({ status: 200, description: 'Token y datos del usuario' })
  @ApiResponse({ status: 401, description: 'Email o contraseña incorrectos' })
  login(@Body() dto: LoginDto): Promise<SesionIniciada> {
    return this.auth.login(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Devuelve el usuario del token' })
  @ApiResponse({ status: 401, description: 'Falta el token o no es válido' })
  me(@UsuarioActual() usuario: Usuario): Usuario {
    return usuario;
  }
}
