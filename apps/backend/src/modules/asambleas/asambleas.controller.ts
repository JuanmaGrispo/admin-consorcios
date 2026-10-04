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
import { AsambleasService } from './asambleas.service';
import { CargarActaDto } from './dto/cargar-acta.dto';
import { ConfirmarAsistenciaDto } from './dto/confirmar-asistencia.dto';
import { CreateAsambleaDto } from './dto/create-asamblea.dto';
import { ListarAsambleasQuery } from './dto/listar-asambleas.query';
import { RegistrarAsistenciaDto } from './dto/registrar-asistencia.dto';
import { ReemplazarOrdenDiaDto } from './dto/reemplazar-orden-dia.dto';
import { UpdateAsambleaDto } from './dto/update-asamblea.dto';

/**
 * Un solo controller para los dos portales: el service recorta lo que ve el
 * vecino (sólo asambleas convocadas de sus consorcios).
 */
@ApiTags('asambleas')
@ApiBearerAuth()
@Controller('asambleas')
export class AsambleasController {
  constructor(private readonly asambleas: AsambleasService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista asambleas con su quórum',
    description: 'El administrador ve todas; el vecino, las convocadas de sus consorcios.',
  })
  listar(@UsuarioActual() usuario: Usuario, @Query() query: ListarAsambleasQuery) {
    return this.asambleas.listar(usuario, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle con orden del día y quórum en vivo' })
  @ApiResponse({ status: 404, description: 'No existe o no es visible' })
  findOne(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return this.asambleas.findOne(usuario, id);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Post()
  @ApiOperation({ summary: 'Crea una asamblea en borrador' })
  crear(@UsuarioActual() usuario: Usuario, @Body() dto: CreateAsambleaDto) {
    return this.asambleas.crear(usuario, dto);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Patch(':id')
  @ApiOperation({ summary: 'Edita una asamblea en borrador' })
  editar(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAsambleaDto,
  ) {
    return this.asambleas.editar(usuario, id, dto);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Elimina una asamblea en borrador' })
  eliminar(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return this.asambleas.eliminar(usuario, id);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Put(':id/orden-dia')
  @ApiOperation({ summary: 'Reemplaza el orden del día completo (sólo en borrador)' })
  reemplazarOrdenDia(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReemplazarOrdenDiaDto,
  ) {
    return this.asambleas.reemplazarOrdenDia(usuario, id, dto);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Post(':id/convocar')
  @ApiOperation({
    summary: 'Convoca: arma el padrón de asistencia y avisa a los vecinos',
    description: 'Copia el coeficiente de cada unidad activa al momento de convocar.',
  })
  convocar(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return this.asambleas.convocar(usuario, id);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Post(':id/iniciar')
  @ApiOperation({ summary: 'Pasa a EN_CURSO (no exige quórum)' })
  iniciar(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return this.asambleas.iniciar(usuario, id);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Post(':id/cerrar')
  @ApiOperation({ summary: 'Cierra: CERRADA o CERRADA_SIN_QUORUM según el quórum alcanzado' })
  cerrar(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return this.asambleas.cerrar(usuario, id);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Patch(':id/acta')
  @ApiOperation({
    summary: 'Carga el acta de una asamblea cerrada',
    description: 'La URL tiene que venir de POST /archivos?destino=actas.',
  })
  cargarActa(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CargarActaDto,
  ) {
    return this.asambleas.cargarActa(usuario, id, dto);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Get(':id/asistencias')
  @ApiOperation({ summary: 'Padrón completo de asistencia' })
  listarAsistencias(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return this.asambleas.listarAsistencias(usuario, id);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Patch(':id/asistencias/:unidadId')
  @ApiOperation({ summary: 'Registra la asistencia de una unidad (incluye poderes)' })
  registrarAsistencia(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('unidadId', ParseUUIDPipe) unidadId: string,
    @Body() dto: RegistrarAsistenciaDto,
  ) {
    return this.asambleas.registrarAsistencia(usuario, id, unidadId, dto);
  }

  @Roles(RolUsuario.VECINO)
  @Put(':id/asistencia')
  @ApiOperation({
    summary: 'El vecino responde "Asisto" o "No puedo"',
    description: 'La unidad se infiere si tiene una sola en el consorcio.',
  })
  confirmarAsistencia(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmarAsistenciaDto,
  ) {
    return this.asambleas.confirmarAsistencia(usuario, id, dto);
  }
}
