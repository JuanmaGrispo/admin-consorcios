import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { UsuarioActual as Usuario } from '../auth/auth.types';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import { BandejaService } from './bandeja.service';
import { ListarNotificacionesQuery } from './dto/listar-notificaciones.query';

/** Cada uno ve sólo su bandeja, cualquiera sea su rol. */
@ApiTags('notificaciones')
@ApiBearerAuth()
@Controller('notificaciones')
export class BandejaController {
  constructor(private readonly bandeja: BandejaService) {}

  @Get()
  @ApiOperation({
    summary: 'El centro de notificaciones propio',
    description: 'De la más nueva a la más vieja, con `noLeidas` para el número de la campana.',
  })
  listar(@UsuarioActual() usuario: Usuario, @Query() query: ListarNotificacionesQuery) {
    return this.bandeja.listar(usuario.id, query);
  }

  @Patch(':id/leida')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Marca una como leída', description: 'Repetirlo no hace nada. Ajena: 404.' })
  marcarLeida(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return this.bandeja.marcarLeida(usuario.id, id);
  }

  @Post('leer-todas')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Marca todas como leídas' })
  marcarTodas(@UsuarioActual() usuario: Usuario) {
    return this.bandeja.marcarTodas(usuario.id);
  }
}
