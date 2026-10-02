import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '../../database/entities';
import type { UsuarioActual as Usuario } from '../auth/auth.types';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import { InicioService } from './inicio.service';

@ApiTags('inicio')
@ApiBearerAuth()
@Controller('inicio')
export class InicioController {
  constructor(private readonly inicio: InicioService) {}

  @Roles(RolUsuario.VECINO)
  @Get()
  @ApiOperation({
    summary: 'La pantalla de inicio del vecino',
    description:
      'Sus unidades con el saldo de expensas y los reclamos abiertos de cada una. Todavía no trae próximos eventos ni novedades: faltan los módulos de asambleas, reservas y novedades.',
  })
  paraElVecino(@UsuarioActual() usuario: Usuario) {
    return this.inicio.paraElVecino(usuario);
  }
}
