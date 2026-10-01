import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '../../database/entities';
import type { UsuarioActual as Usuario } from '../auth/auth.types';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import { ListarPagosQuery } from './dto/listar-pagos.query';
import { RegistrarPagoDto } from './dto/registrar-pago.dto';
import { PagosService } from './pagos.service';

@ApiTags('pagos')
@ApiBearerAuth()
@Controller('pagos')
export class PagosController {
  constructor(private readonly pagos: PagosService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista pagos',
    description: 'El administrador ve todos; el vecino, los de sus unidades.',
  })
  listar(@UsuarioActual() usuario: Usuario, @Query() query: ListarPagosQuery) {
    return this.pagos.listar(usuario, query);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Post()
  @ApiOperation({
    summary: 'Registra un pago manual',
    description:
      'Nace APROBADO y mueve el estado de la boleta. Sólo la última boleta emitida de la unidad, y no más que su saldo.',
  })
  registrar(@UsuarioActual() usuario: Usuario, @Body() dto: RegistrarPagoDto) {
    return this.pagos.registrar(usuario, dto);
  }
}
