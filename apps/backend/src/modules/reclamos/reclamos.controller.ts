import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RolUsuario } from '../../database/entities';
import type { UsuarioActual as Usuario } from '../auth/auth.types';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import { AsignarProveedorDto } from './dto/asignar-proveedor.dto';
import { CambiarEstadoDto } from './dto/cambiar-estado.dto';
import { CrearReclamoDto } from './dto/crear-reclamo.dto';
import { ListarReclamosQuery } from './dto/listar-reclamos.query';
import { MensajeReclamoDto } from './dto/mensaje-reclamo.dto';
import { ReclamosService } from './reclamos.service';

/**
 * Un solo controller para los dos portales: el administrador y el vecino
 * llaman a las mismas rutas y el service recorta lo que cada uno ve. Son dos
 * vistas del mismo módulo, no dos subsistemas.
 */
@ApiTags('reclamos')
@ApiBearerAuth()
@Controller('reclamos')
export class ReclamosController {
  constructor(private readonly reclamos: ReclamosService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista reclamos',
    description:
      'El administrador ve los del consorcio; el vecino, sólo los de sus unidades.',
  })
  listar(@UsuarioActual() usuario: Usuario, @Query() query: ListarReclamosQuery) {
    return this.reclamos.listar(usuario, query);
  }

  @Get('resumen')
  @ApiOperation({ summary: 'Totales por estado y tiempo medio de resolución' })
  @ApiQuery({ name: 'consorcioId', required: false, format: 'uuid' })
  resumen(
    @UsuarioActual() usuario: Usuario,
    @Query('consorcioId') consorcioId?: string,
  ) {
    return this.reclamos.resumen(usuario, consorcioId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Detalle con adjuntos y línea de tiempo',
    description: 'Al vecino no se le devuelven las notas internas.',
  })
  @ApiResponse({ status: 404, description: 'No existe o no es suyo' })
  findOne(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reclamos.findOne(usuario, id);
  }

  @Post()
  @ApiOperation({
    summary: 'Abre un reclamo',
    description:
      'El vecino lo abre sobre su unidad (se infiere si tiene una sola). La prioridad sólo la fija el administrador.',
  })
  crear(@UsuarioActual() usuario: Usuario, @Body() dto: CrearReclamoDto) {
    return this.reclamos.crear(usuario, dto);
  }

  @Post(':id/mensajes')
  @ApiOperation({
    summary: 'Suma un mensaje a la línea de tiempo',
    description:
      'El administrador puede marcarlo como nota interna; el vecino, no.',
  })
  agregarMensaje(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MensajeReclamoDto,
  ) {
    return this.reclamos.agregarMensaje(usuario, id, dto);
  }

  @Patch(':id/proveedor')
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Asigna o reasigna el proveedor',
    description: 'Si el reclamo estaba en NUEVO, pasa a EN_CURSO.',
  })
  asignarProveedor(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AsignarProveedorDto,
  ) {
    return this.reclamos.asignarProveedor(usuario, id, dto);
  }

  @Patch(':id/estado')
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Cambia el estado',
    description: 'Pasar a RESUELTO cierra el caso; volver a otro estado lo reabre.',
  })
  cambiarEstado(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarEstadoDto,
  ) {
    return this.reclamos.cambiarEstado(usuario, id, dto);
  }
}
