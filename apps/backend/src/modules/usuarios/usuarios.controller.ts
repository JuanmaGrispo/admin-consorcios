import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '../../database/entities';
import type { UsuarioActual as Usuario } from '../auth/auth.types';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { ListarUsuariosQuery } from './dto/listar-usuarios.query';
import { NuevaPasswordDto } from './dto/nueva-password.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { UsuariosService } from './usuarios.service';

/**
 * Cuentas de la plataforma. El superadmin gestiona todas; el administrador,
 * los vecinos de sus consorcios. Los vecinos se dan de alta desde la unidad
 * (`POST /unidades/:id/vinculos`), así nunca queda uno sin dónde vivir.
 */
@ApiTags('usuarios')
@ApiBearerAuth()
@Roles(RolUsuario.ADMINISTRADOR)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista usuarios',
    description:
      'Superadmin: todos (filtro `rol`). Administrador: los vecinos de sus consorcios. Con `email`, busca uno exacto.',
  })
  listar(@UsuarioActual() usuario: Usuario, @Query() query: ListarUsuariosQuery) {
    return this.usuarios.listar(usuario, query);
  }

  @Get(':id')
  findOne(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return this.usuarios.findVisible(usuario, id);
  }

  @Roles(RolUsuario.SUPER_ADMIN)
  @Post()
  create(@Body() dto: CreateUsuarioDto) {
    return this.usuarios.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edita datos de la cuenta', description: '`activo` es sólo del superadmin.' })
  update(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUsuarioDto,
  ) {
    return this.usuarios.update(usuario, id, dto);
  }

  @Put(':id/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Le pone una contraseña nueva' })
  resetearPassword(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: NuevaPasswordDto,
  ) {
    return this.usuarios.resetearPassword(usuario, id, dto.password);
  }
}
