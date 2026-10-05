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
import { ActualizarNovedadDto } from './dto/actualizar-novedad.dto';
import { CrearNovedadDto } from './dto/crear-novedad.dto';
import { ListarNovedadesQuery } from './dto/listar-novedades.query';
import { NovedadesService } from './novedades.service';

/** El muro de cada edificio: comunicados del administrador y avisos automáticos. */
@ApiTags('novedades')
@ApiBearerAuth()
@Controller('novedades')
export class NovedadesController {
  constructor(private readonly novedades: NovedadesService) {}

  @Get()
  @ApiOperation({
    summary: 'El muro',
    description: 'Fijadas primero. El vecino ve las de donde vive con `leida`; el administrador, las de sus consorcios con `lecturas`.',
  })
  listar(@UsuarioActual() usuario: Usuario, @Query() query: ListarNovedadesQuery) {
    return this.novedades.listar(usuario, query);
  }

  @Get(':id')
  findOne(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return this.novedades.findOne(usuario, id);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Post()
  @ApiOperation({ summary: 'Publica un comunicado', description: 'Les llega por mail a los vecinos.' })
  crear(@UsuarioActual() usuario: Usuario, @Body() dto: CrearNovedadDto) {
    return this.novedades.crear(usuario, dto);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Patch(':id')
  @ApiOperation({ summary: 'Edita, fija o da de baja una novedad' })
  actualizar(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarNovedadDto,
  ) {
    return this.novedades.actualizar(usuario, id, dto);
  }

  @Roles(RolUsuario.VECINO)
  @Put(':id/lectura')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'La marca como leída' })
  marcarLeida(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return this.novedades.marcarLeida(usuario, id);
  }
}
