import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { UsuarioActual as Usuario } from '../auth/auth.types';
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
  constructor(private readonly usuarios: UsuariosService) {}

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
  @ApiOperation({ summary: 'Cambia la contraseña propia', description: 'Pide la actual.' })
  cambiarPassword(@UsuarioActual() usuario: Usuario, @Body() dto: CambiarPasswordDto) {
    return this.usuarios.cambiarPassword(usuario.id, dto);
  }
}
