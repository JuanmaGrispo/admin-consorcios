import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '../../database/entities';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UsuariosService } from './usuarios.service';

/**
 * Gestión de usuarios de la plataforma. Todo es del superadmin: los
 * administradores gestionan consorcios, no cuentas.
 */
@ApiTags('usuarios')
@ApiBearerAuth()
@Roles(RolUsuario.SUPER_ADMIN)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get()
  @ApiQuery({ name: 'rol', enum: RolUsuario, required: false })
  findAll(@Query('rol') rol?: RolUsuario) {
    return this.usuarios.findAll(rol);
  }

  @Post()
  create(@Body() dto: CreateUsuarioDto) {
    return this.usuarios.create(dto);
  }
}
