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
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '../../database/entities';
import type { UsuarioActual as Usuario } from '../auth/auth.types';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import { AjustarBoletaDto } from './dto/ajustar-boleta.dto';
import { CreateGastoDto } from './dto/create-gasto.dto';
import { CreateLiquidacionDto } from './dto/create-liquidacion.dto';
import { EnviarRecordatoriosDto } from './dto/enviar-recordatorios.dto';
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
  listar(@UsuarioActual() usuario: Usuario, @Query() query: ListarLiquidacionesQuery) {
    return this.expensas.listar(usuario, query);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Get('liquidaciones/:id')
  @ApiOperation({ summary: 'Liquidación con sus gastos' })
  findOne(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return this.expensas.findOne(usuario, id);
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
  update(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLiquidacionDto) {
    return this.expensas.update(usuario, id, dto);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Delete('liquidaciones/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Borra una liquidación sin emitir', description: 'Con sus gastos y boletas.' })
  remove(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return this.expensas.remove(usuario, id);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Post('liquidaciones/:id/previsualizar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Calcula las boletas',
    description:
      'Pasa a PREVISUALIZACION. Se puede repetir; los ajustes manuales se conservan.',
  })
  previsualizar(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return this.expensas.previsualizar(usuario, id);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Post('liquidaciones/:id/emitir')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Emite las boletas',
    description:
      'Recalcula por última vez, congela las boletas y avisa a los vecinos. No se puede deshacer.',
  })
  emitir(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return this.expensas.emitir(usuario, id);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Post('liquidaciones/:id/cerrar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cierra una liquidación emitida' })
  cerrar(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return this.expensas.cerrar(usuario, id);
  }

  // ── Gastos ──

  @Roles(RolUsuario.ADMINISTRADOR)
  @Post('liquidaciones/:id/gastos')
  @ApiOperation({
    summary: 'Carga un gasto',
    description: 'Sin `naturaleza`, toma la del rubro. Si estaba previsualizada, recalcula.',
  })
  agregarGasto(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateGastoDto) {
    return this.expensas.agregarGasto(usuario, id, dto);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Patch('liquidaciones/:id/gastos/:gastoId')
  actualizarGasto(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('gastoId', ParseUUIDPipe) gastoId: string,
    @Body() dto: UpdateGastoDto,
  ) {
    return this.expensas.actualizarGasto(usuario, id, gastoId, dto);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Delete('liquidaciones/:id/gastos/:gastoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  borrarGasto(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('gastoId', ParseUUIDPipe) gastoId: string,
  ) {
    return this.expensas.borrarGasto(usuario, id, gastoId);
  }

  // ── Boletas ──

  @Get('boletas')
  @ApiOperation({
    summary: 'Grilla de cobranzas',
    description:
      'Paginada. Cada fila trae lo pagado, el saldo, el medio del último pago y —para quien administra— los ocupantes de la unidad. El administrador ve todas las boletas; el vecino, las emitidas de sus unidades.',
  })
  listarBoletas(@UsuarioActual() usuario: Usuario, @Query() query: ListarBoletasQuery) {
    return this.expensas.listarBoletas(usuario, query);
  }

  // Antes de `boletas/:id`: si no, Nest intentaría leer "resumen" como un id.
  @Get('boletas/resumen')
  @ApiOperation({
    summary: 'Totales de cobranza del alcance',
    description:
      'Emitido, cobrado, saldo pendiente e intereses, más el conteo de cada solapa. Toma los mismos filtros que la grilla, salvo `estado` y `situacion`.',
  })
  resumenCobranzas(@UsuarioActual() usuario: Usuario, @Query() query: ListarBoletasQuery) {
    return this.expensas.resumenCobranzas(usuario, query);
  }

  @Get('boletas/exportar')
  @ApiOperation({
    summary: 'La grilla en CSV',
    description:
      'Mismos filtros que la grilla, sin paginar. CSV con `;` y BOM: Excel en español lo abre en columnas sin pasar por el asistente.',
  })
  @ApiProduces('text/csv')
  async exportarCobranzas(
    @UsuarioActual() usuario: Usuario,
    @Query() query: ListarBoletasQuery,
  ) {
    const { csv, nombre } = await this.expensas.exportarCobranzas(usuario, query);
    return new StreamableFile(Buffer.from(csv, 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${nombre}"`,
    });
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Post('boletas/recordatorios')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Avisa a quienes deben',
    description:
      'Un aviso por vecino de cada boleta con saldo del alcance. Nunca a quien ya pagó. Devuelve cuántos avisos salieron.',
  })
  enviarRecordatorios(@UsuarioActual() usuario: Usuario, @Body() dto: EnviarRecordatoriosDto) {
    return this.expensas.enviarRecordatorios(usuario, dto);
  }

  @Get('boletas/:id')
  @ApiOperation({ summary: 'Boleta con su detalle' })
  @ApiResponse({ status: 404, description: 'No existe, no es suya o no se emitió' })
  findBoleta(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return this.expensas.findBoleta(usuario, id);
  }

  @Get('boletas/:id/pdf')
  @ApiOperation({ summary: 'Boleta en PDF', description: 'Mismos permisos que el detalle.' })
  @ApiProduces('application/pdf')
  async pdfBoleta(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    const { buffer, nombre } = await this.expensas.pdfBoleta(usuario, id);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `inline; filename="${nombre}"`,
    });
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Patch('boletas/:id/ajuste')
  @ApiOperation({
    summary: 'Ajuste manual',
    description: 'Sólo en previsualización. El motivo es obligatorio y el vecino lo ve.',
  })
  ajustarBoleta(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AjustarBoletaDto) {
    return this.expensas.ajustarBoleta(usuario, id, dto);
  }
}
