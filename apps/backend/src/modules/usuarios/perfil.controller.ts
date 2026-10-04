import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { UsuarioActual as Usuario } from '../auth/auth.types';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import { ActualizarPerfilDto } from './dto/actualizar-perfil.dto';
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

  @Put('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cambia la contraseña propia', description: 'Pide la actual.' })
  cambiarPassword(@UsuarioActual() usuario: Usuario, @Body() dto: CambiarPasswordDto) {
    return this.usuarios.cambiarPassword(usuario.id, dto);
  }
}
