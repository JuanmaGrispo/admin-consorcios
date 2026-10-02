import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '../../database/entities';
import type { UsuarioActual as Usuario } from '../auth/auth.types';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import { CrearPreferenciaDto } from './dto/crear-preferencia.dto';
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

  @Post('mercadopago/preferencia')
  @ApiOperation({
    summary: 'Arranca un cobro con Mercado Pago',
    description: 'Por el saldo de la boleta. Devuelve `initPoint`, la URL del checkout.',
  })
  crearPreferencia(@UsuarioActual() usuario: Usuario, @Body() dto: CrearPreferenciaDto) {
    return this.pagos.crearPreferencia(usuario, dto.boletaId);
  }

  /**
   * Abierto porque lo llama Mercado Pago, que no tiene sesión. Lo que lo
   * protege es la firma: sin una válida, 401.
   */
  @Public()
  @Post('webhook/mercadopago')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async webhook(
    @Query('type') tipoQuery: string | undefined,
    @Query('data.id') dataIdQuery: string | undefined,
    @Body() cuerpo: { type?: string; data?: { id?: string | number } },
    @Headers('x-signature') firma: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    await this.pagos.procesarWebhook({
      tipo: tipoQuery ?? cuerpo?.type,
      dataId: dataIdQuery ?? (cuerpo?.data?.id === undefined ? undefined : String(cuerpo.data.id)),
      firma,
      requestId,
    });
  }
}
