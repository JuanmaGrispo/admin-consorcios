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
import { CrearBloqueoDto } from './dto/crear-bloqueo.dto';
import { CrearReservaDto } from './dto/crear-reserva.dto';
import { CreateAmenityDto } from './dto/create-amenity.dto';
import { DisponibilidadQuery } from './dto/disponibilidad.query';
import { ListarAmenitiesQuery } from './dto/listar-amenities.query';
import { ListarBloqueosQuery } from './dto/listar-bloqueos.query';
import { ListarReservasQuery } from './dto/listar-reservas.query';
import { RechazarReservaDto } from './dto/rechazar-reserva.dto';
import { UpdateAmenityDto } from './dto/update-amenity.dto';
import { ReservasService } from './reservas.service';

/**
 * Dos recursos de un mismo módulo: los amenities (con sus bloqueos), que son
 * del administrador, y las reservas, que además abre el vecino. Por eso el
 * controller no lleva prefijo y cada ruta dice el suyo.
 */
@ApiTags('reservas')
@ApiBearerAuth()
@Controller()
export class ReservasController {
  constructor(private readonly reservas: ReservasService) {}

  // ── Amenities ──

  @Get('amenities')
  @ApiOperation({
    summary: 'Lista amenities',
    description: 'El vecino recibe sólo los activos de los consorcios donde vive.',
  })
  listarAmenities(@UsuarioActual() usuario: Usuario, @Query() query: ListarAmenitiesQuery) {
    return this.reservas.listarAmenities(usuario, query);
  }

  @Get('amenities/:id')
  @ApiResponse({ status: 404, description: 'No existe o no es de un consorcio suyo' })
  findAmenity(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return this.reservas.findAmenity(usuario, id);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Post('amenities')
  crearAmenity(@UsuarioActual() usuario: Usuario, @Body() dto: CreateAmenityDto) {
    return this.reservas.crearAmenity(usuario, dto);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Patch('amenities/:id')
  @ApiOperation({ summary: 'Edita un amenity', description: '`activo: false` lo da de baja.' })
  actualizarAmenity(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAmenityDto,
  ) {
    return this.reservas.actualizarAmenity(usuario, id, dto);
  }

  @Get('amenities/:id/disponibilidad')
  @ApiOperation({
    summary: 'Ventana y franjas ocupadas de un día',
    description: 'Lo que el calendario necesita para ofrecer horarios.',
  })
  disponibilidad(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: DisponibilidadQuery,
  ) {
    return this.reservas.disponibilidad(usuario, id, query);
  }

  // ── Bloqueos de mantenimiento ──

  @Roles(RolUsuario.ADMINISTRADOR)
  @Get('amenities/:amenityId/bloqueos')
  listarBloqueos(
    @UsuarioActual() usuario: Usuario,
    @Param('amenityId', ParseUUIDPipe) amenityId: string,
    @Query() query: ListarBloqueosQuery,
  ) {
    return this.reservas.listarBloqueos(usuario, amenityId, query);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Post('amenities/:amenityId/bloqueos')
  @ApiResponse({ status: 409, description: 'Pisa reservas y no se mandó `cancelarReservas`' })
  crearBloqueo(
    @UsuarioActual() usuario: Usuario,
    @Param('amenityId', ParseUUIDPipe) amenityId: string,
    @Body() dto: CrearBloqueoDto,
  ) {
    return this.reservas.crearBloqueo(usuario, amenityId, dto);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Delete('amenities/:amenityId/bloqueos/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  borrarBloqueo(
    @UsuarioActual() usuario: Usuario,
    @Param('amenityId', ParseUUIDPipe) amenityId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reservas.borrarBloqueo(usuario, amenityId, id);
  }

  // ── Reservas ──

  @Get('reservas')
  @ApiOperation({
    summary: 'Lista reservas',
    description: 'El vecino recibe sólo las de sus unidades.',
  })
  listar(@UsuarioActual() usuario: Usuario, @Query() query: ListarReservasQuery) {
    return this.reservas.listar(usuario, query);
  }

  @Get('reservas/:id')
  @ApiResponse({ status: 404, description: 'No existe o no es de una unidad suya' })
  findOne(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return this.reservas.findOne(usuario, id);
  }

  @Post('reservas')
  @ApiOperation({
    summary: 'Reserva un amenity',
    description: 'Nace PENDIENTE o APROBADA según `requiereAprobacion` del amenity.',
  })
  crear(@UsuarioActual() usuario: Usuario, @Body() dto: CrearReservaDto) {
    return this.reservas.crear(usuario, dto);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Patch('reservas/:id/aprobar')
  aprobar(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return this.reservas.aprobar(usuario, id);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Patch('reservas/:id/rechazar')
  rechazar(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RechazarReservaDto,
  ) {
    return this.reservas.rechazar(usuario, id, dto);
  }

  @Patch('reservas/:id/cancelar')
  @ApiOperation({
    summary: 'Cancela una reserva',
    description: 'El vecino puede cancelar las suyas mientras no hayan empezado.',
  })
  cancelar(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return this.reservas.cancelar(usuario, id);
  }
}
