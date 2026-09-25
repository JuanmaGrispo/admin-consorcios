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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '../../database/entities';
import type { UsuarioActual as Usuario } from '../auth/auth.types';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import { AjustarBoletaDto } from './dto/ajustar-boleta.dto';
import { CreateGastoDto } from './dto/create-gasto.dto';
import { CreateLiquidacionDto } from './dto/create-liquidacion.dto';
import { ListarBoletasQuery } from './dto/listar-boletas.query';
import { ListarLiquidacionesQuery } from './dto/listar-liquidaciones.query';
import { UpdateGastoDto } from './dto/update-gasto.dto';
import { UpdateLiquidacionDto } from './dto/update-liquidacion.dto';
import { ExpensasService } from './expensas.service';

/**
 * Dos recursos de un mismo módulo: las liquidaciones (con sus gastos), que
 * son del administrador, y las boletas, que además lee el vecino. Por eso el
 * controller no lleva prefijo y cada ruta dice el suyo.
 */
@ApiTags('expensas')
@ApiBearerAuth()
@Controller()
export class ExpensasController {
  constructor(private readonly expensas: ExpensasService) {}

  // ── Liquidaciones ──

  @Roles(RolUsuario.ADMINISTRADOR)
  @Get('liquidaciones')
  @ApiOperation({ summary: 'Lista liquidaciones', description: 'Con `cantidadGastos` y `cantidadBoletas`.' })
  listar(@Query() query: ListarLiquidacionesQuery) {
    return this.expensas.listar(query);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Get('liquidaciones/:id')
  @ApiOperation({ summary: 'Liquidación con sus gastos' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.expensas.findOne(id);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Post('liquidaciones')
  @ApiOperation({
    summary: 'Abre la liquidación de un período',
    description:
      'Nace en BORRADOR. Una por consorcio y período, y nunca de un período igual o anterior al último emitido.',
  })
  create(@UsuarioActual() usuario: Usuario, @Body() dto: CreateLiquidacionDto) {
    return this.expensas.create(usuario, dto);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Patch('liquidaciones/:id')
  @ApiOperation({
    summary: 'Cambia criterio de prorrateo o vencimiento',
    description: 'Sólo antes de emitir. Si estaba previsualizada, recalcula las boletas.',
  })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLiquidacionDto) {
    return this.expensas.update(id, dto);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Delete('liquidaciones/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Borra una liquidación sin emitir', description: 'Con sus gastos y boletas.' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.expensas.remove(id);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Post('liquidaciones/:id/previsualizar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Calcula las boletas',
    description:
      'Pasa a PREVISUALIZACION. Se puede repetir; los ajustes manuales se conservan.',
  })
  previsualizar(@Param('id', ParseUUIDPipe) id: string) {
    return this.expensas.previsualizar(id);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Post('liquidaciones/:id/emitir')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Emite las boletas',
    description:
      'Recalcula por última vez, congela las boletas y avisa a los vecinos. No se puede deshacer.',
  })
  emitir(@Param('id', ParseUUIDPipe) id: string) {
    return this.expensas.emitir(id);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Post('liquidaciones/:id/cerrar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cierra una liquidación emitida' })
  cerrar(@Param('id', ParseUUIDPipe) id: string) {
    return this.expensas.cerrar(id);
  }

  // ── Gastos ──

  @Roles(RolUsuario.ADMINISTRADOR)
  @Post('liquidaciones/:id/gastos')
  @ApiOperation({
    summary: 'Carga un gasto',
    description: 'Sin `naturaleza`, toma la del rubro. Si estaba previsualizada, recalcula.',
  })
  agregarGasto(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateGastoDto) {
    return this.expensas.agregarGasto(id, dto);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Patch('liquidaciones/:id/gastos/:gastoId')
  actualizarGasto(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('gastoId', ParseUUIDPipe) gastoId: string,
    @Body() dto: UpdateGastoDto,
  ) {
    return this.expensas.actualizarGasto(id, gastoId, dto);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Delete('liquidaciones/:id/gastos/:gastoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  borrarGasto(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('gastoId', ParseUUIDPipe) gastoId: string,
  ) {
    return this.expensas.borrarGasto(id, gastoId);
  }

  // ── Boletas ──

  @Get('boletas')
  @ApiOperation({
    summary: 'Lista boletas',
    description: 'El administrador ve todas; el vecino, las emitidas de sus unidades.',
  })
  listarBoletas(@UsuarioActual() usuario: Usuario, @Query() query: ListarBoletasQuery) {
    return this.expensas.listarBoletas(usuario, query);
  }

  @Get('boletas/:id')
  @ApiOperation({ summary: 'Boleta con su detalle' })
  @ApiResponse({ status: 404, description: 'No existe, no es suya o no se emitió' })
  findBoleta(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return this.expensas.findBoleta(usuario, id);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Patch('boletas/:id/ajuste')
  @ApiOperation({
    summary: 'Ajuste manual',
    description: 'Sólo en previsualización. El motivo es obligatorio y el vecino lo ve.',
  })
  ajustarBoleta(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AjustarBoletaDto) {
    return this.expensas.ajustarBoleta(id, dto);
  }
}
