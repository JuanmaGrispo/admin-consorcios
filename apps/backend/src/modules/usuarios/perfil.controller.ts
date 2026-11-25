import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Put, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthService } from '../auth/auth.service';
import type { UsuarioActual as Usuario } from '../auth/auth.types';
import { ponerCookieSesion } from '../auth/cookie-sesion';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import { ActualizarPerfilDto } from './dto/actualizar-perfil.dto';
import { ActualizarPreferenciasDto } from './dto/actualizar-preferencias.dto';
import { CambiarPasswordDto } from './dto/cambiar-password.dto';
import { UsuariosService } from './usuarios.service';

/** La cuenta de quien está logueado, cualquiera sea su rol. */
@ApiTags('perfil')
@ApiBearerAuth()
@Controller('perfil')
export class PerfilController {
  constructor(
    private readonly usuarios: UsuariosService,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  perfil(@UsuarioActual() usuario: Usuario) {
    return this.usuarios.perfil(usuario.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Edita nombre, teléfono y avatar propios' })
  actualizar(@UsuarioActual() usuario: Usuario, @Body() dto: ActualizarPerfilDto) {
    return this.usuarios.actualizarPerfil(usuario.id, dto);
  }

  @Get('preferencias')
  @ApiOperation({
    summary: 'Cómo quiere recibir los avisos',
    description:
      'Grilla canal × categoría. Sin nada guardado, todo habilitado. Hoy sólo envía EMAIL: los otros canales vienen con disponible: false.',
  })
  preferencias(@UsuarioActual() usuario: Usuario) {
    return this.usuarios.preferencias(usuario.id);
  }

  @Put('preferencias')
  @ApiOperation({ summary: 'Cambia preferencias de aviso', description: 'Sólo las que vienen; devuelve la grilla completa.' })
  actualizarPreferencias(@UsuarioActual() usuario: Usuario, @Body() dto: ActualizarPreferenciasDto) {
    return this.usuarios.actualizarPreferencias(usuario.id, dto);
  }

  @Put('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Cambia la contraseña propia',
    description: 'Pide la actual. Corta las demás sesiones abiertas y renueva la cookie de esta.',
  })
  async cambiarPassword(
    @UsuarioActual() usuario: Usuario,
    @Body() dto: CambiarPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.usuarios.cambiarPassword(usuario.id, dto);
    // El cambio invalida todos los tokens anteriores (AUT10), incluido el de
    // este pedido: se emite uno nuevo para no sacar al usuario de la app.
    ponerCookieSesion(res, await this.auth.renovarSesion(usuario.id), this.config);
  }
}
