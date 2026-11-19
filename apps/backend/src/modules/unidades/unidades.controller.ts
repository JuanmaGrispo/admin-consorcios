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
  Query,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RolUsuario } from '../../database/entities';
import type { UsuarioActual as Usuario } from '../auth/auth.types';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import { CreateUnidadDto } from './dto/create-unidad.dto';
import { ExportarPadronQuery } from './dto/exportar-padron.query';
import { ListarUnidadesQuery } from './dto/listar-unidades.query';
import { UpdateUnidadDto } from './dto/update-unidad.dto';
import { VincularUsuarioDto } from './dto/vincular-usuario.dto';
import { UnidadesService } from './unidades.service';

/**
 * Unidades funcionales y quién vive en cada una. Leer está abierto a cualquier
 * logueado (el vecino ve sólo las suyas); cargar y vincular es del administrador.
 */
@ApiTags('unidades')
@ApiBearerAuth()
@Controller('unidades')
export class UnidadesController {
  constructor(private readonly unidades: UnidadesService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista unidades',
    description:
      'Cada una con `cantidadVecinos` vigentes. El vecino recibe sólo las unidades a las que está vinculado.',
  })
  listar(@UsuarioActual() usuario: Usuario, @Query() query: ListarUnidadesQuery) {
    return this.unidades.listar(usuario, query);
  }

  // Antes de `:id`: si no, "exportar" se tomaría como un id y fallaría el ParseUUIDPipe.
  @Roles(RolUsuario.ADMINISTRADOR)
  @Get('exportar')
  @ApiOperation({
    summary: 'El padrón en CSV',
    description:
      'Unidades del consorcio con propietarios e inquilinos vigentes y su contacto. CSV con `;` y BOM: Excel en español lo abre en columnas.',
  })
  @ApiProduces('text/csv')
  async exportarPadron(@UsuarioActual() usuario: Usuario, @Query() query: ExportarPadronQuery) {
    const { csv, nombre } = await this.unidades.exportarPadron(usuario, query);
    return new StreamableFile(Buffer.from(csv, 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${nombre}"`,
    });
  }

  @Get(':id')
  @ApiResponse({ status: 404, description: 'No existe o no es suya' })
  findOne(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.unidades.findOne(usuario, id);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Post()
  @ApiOperation({
    summary: 'Alta de unidad',
    description: 'La etiqueta es única en el consorcio y los coeficientes activos no pueden pasar el 100%.',
  })
  create(@UsuarioActual() usuario: Usuario, @Body() dto: CreateUnidadDto) {
    return this.unidades.create(usuario, dto);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Patch(':id')
  @ApiOperation({
    summary: 'Edita la unidad',
    description: 'Con `activa: false` se da de baja. No hay DELETE: boletas, pagos y reclamos la referencian.',
  })
  update(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUnidadDto,
  ) {
    return this.unidades.update(usuario, id, dto);
  }

  // ── Vínculos ──

  @Roles(RolUsuario.ADMINISTRADOR)
  @Get(':id/vinculos')
  @ApiOperation({ summary: 'Vecinos vinculados a la unidad' })
  @ApiQuery({ name: 'incluirTerminados', required: false, type: Boolean })
  listarVinculos(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('incluirTerminados') incluirTerminados?: string,
  ) {
    return this.unidades.listarVinculos(usuario, id, incluirTerminados === 'true');
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Post(':id/vinculos')
  @ApiOperation({
    summary: 'Vincula un vecino a la unidad',
    description:
      'Como propietario o inquilino. Con `nuevoUsuario` lo da de alta en el mismo paso. Hay un solo titular vigente por unidad.',
  })
  vincular(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VincularUsuarioDto,
  ) {
    return this.unidades.vincular(usuario, id, dto);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Delete(':id/vinculos/:vinculoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Termina el vínculo',
    description:
      'Le pone fecha de fin hoy y queda en el historial. Si todavía no había empezado a regir, se borra.',
  })
  desvincular(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('vinculoId', ParseUUIDPipe) vinculoId: string,
  ) {
    return this.unidades.desvincular(usuario, id, vinculoId);
  }
}
