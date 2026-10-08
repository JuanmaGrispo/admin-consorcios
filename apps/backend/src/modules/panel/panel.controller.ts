import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '../../database/entities';
import type { UsuarioActual as Usuario } from '../auth/auth.types';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import { PanelQuery } from './dto/panel.query';
import { PanelService } from './panel.service';

@ApiTags('panel')
@ApiBearerAuth()
@Controller('panel')
export class PanelController {
  constructor(private readonly panel: PanelService) {}

  @Roles(RolUsuario.ADMINISTRADOR)
  @Get()
  @ApiOperation({
    summary: 'El panel general del administrador',
    description:
      'Cobranza del período en todos sus consorcios (con el anterior para comparar), la serie de los últimos 6 meses, la actividad de hoy, lo que requiere atención y el estado de cada consorcio.',
  })
  delAdministrador(@UsuarioActual() usuario: Usuario, @Query() query: PanelQuery) {
    return this.panel.delAdministrador(usuario, query.periodo);
  }
}
