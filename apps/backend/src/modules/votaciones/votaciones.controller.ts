import {
  Body,
  Controller,
  Delete,
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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '../../database/entities';
import type { UsuarioActual as Usuario } from '../auth/auth.types';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import { CreateVotacionDto } from './dto/create-votacion.dto';
import { ListarVotacionesQuery } from './dto/listar-votaciones.query';
import { ReemplazarOpcionesDto } from './dto/reemplazar-opciones.dto';
import { UpdateVotacionDto } from './dto/update-votacion.dto';
import { VotarDto } from './dto/votar.dto';
import { VotoPresencialDto } from './dto/voto-presencial.dto';
import { VotacionesService } from './votaciones.service';

/**
 * Un solo controller para los dos portales: el vecino vota desde la app y la
 * administración carga los votos presenciales de una asamblea.
 */
@ApiTags('votaciones')
@ApiBearerAuth()
@Controller('votaciones')
export class VotacionesController {
  constructor(private readonly votaciones: VotacionesService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista votaciones',
    description: 'El administrador ve todas; el vecino, las publicadas de sus consorcios.',
  })
  listar(@UsuarioActual() usuario: Usuario, @Query() query: ListarVotacionesQuery) {
    return this.votaciones.listar(usuario, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Detalle con opciones y escrutinio',
    description: 'Al vecino: sus unidades habilitadas, su voto y el parcial sólo si corresponde.',
  })
  @ApiResponse({ status: 404, description: 'No existe o no es visible' })
  findOne(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return this.votaciones.findOne(usuario, id);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Post()
  @ApiOperation({ summary: 'Crea una votación en borrador, independiente o sobre un punto del orden del día' })
  crear(@UsuarioActual() usuario: Usuario, @Body() dto: CreateVotacionDto) {
    return this.votaciones.crear(usuario, dto);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Patch(':id')
  @ApiOperation({ summary: 'Edita una votación en borrador' })
  editar(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVotacionDto,
  ) {
    return this.votaciones.editar(usuario, id, dto);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Elimina una votación en borrador' })
  eliminar(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return this.votaciones.eliminar(usuario, id);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Put(':id/opciones')
  @ApiOperation({ summary: 'Reemplaza las opciones no fijas (sólo en borrador)' })
  reemplazarOpciones(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReemplazarOpcionesDto,
  ) {
    return this.votaciones.reemplazarOpciones(usuario, id, dto);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Post(':id/publicar')
  @ApiOperation({ summary: 'Abre la votación y avisa a los vecinos' })
  publicar(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return this.votaciones.publicar(usuario, id);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Post(':id/cerrar')
  @ApiOperation({ summary: 'Cierra y guarda el resultado' })
  cerrar(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return this.votaciones.cerrar(usuario, id);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Get(':id/votos')
  @ApiOperation({ summary: 'Padrón con quién votó, qué y por qué canal' })
  padronConVotos(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return this.votaciones.padronConVotos(usuario, id);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Post(':id/votos/:unidadId')
  @ApiOperation({
    summary: 'Carga el voto presencial de una unidad',
    description: 'Sólo en votaciones de asamblea, con la asamblea en curso. 409 si la unidad ya votó.',
  })
  votarPresencial(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('unidadId', ParseUUIDPipe) unidadId: string,
    @Body() dto: VotoPresencialDto,
  ) {
    return this.votaciones.votarPresencial(usuario, id, unidadId, dto);
  }

  @Roles(RolUsuario.VECINO)
  @Post(':id/votos')
  @ApiOperation({
    summary: 'El vecino vota',
    description: 'Una vez por unidad y sin cambios. 409 si la unidad ya votó, diciendo cuándo y por qué canal.',
  })
  votar(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VotarDto,
  ) {
    return this.votaciones.votar(usuario, id, dto);
  }
}
