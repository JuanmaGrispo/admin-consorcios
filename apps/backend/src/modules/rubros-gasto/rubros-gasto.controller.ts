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
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '../../database/entities';
import type { UsuarioActual as Usuario } from '../auth/auth.types';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import { CreateRubroGastoDto } from './dto/create-rubro-gasto.dto';
import { UpdateRubroGastoDto } from './dto/update-rubro-gasto.dto';
import { RubrosGastoService } from './rubros-gasto.service';

/**
 * Leer es para cualquier logueado: el vecino ve los rubros en el detalle de su
 * boleta. Gestionarlos es del administrador.
 */
@ApiTags('rubros-gasto')
@ApiBearerAuth()
@Controller('rubros-gasto')
export class RubrosGastoController {
  constructor(private readonly rubros: RubrosGastoService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista rubros',
    description: 'Con `consorcioId`, los de ese consorcio más los compartidos.',
  })
  @ApiQuery({ name: 'consorcioId', required: false, format: 'uuid' })
  listar(@Query('consorcioId', new ParseUUIDPipe({ optional: true })) consorcioId?: string) {
    return this.rubros.listar(consorcioId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.rubros.findOne(id);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Post()
  @ApiOperation({
    summary: 'Alta de rubro',
    description: 'Sin `consorcioId` es compartido por todos los consorcios: sólo superadmin.',
  })
  create(@UsuarioActual() usuario: Usuario, @Body() dto: CreateRubroGastoDto) {
    return this.rubros.create(usuario, dto);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Patch(':id')
  update(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRubroGastoDto,
  ) {
    return this.rubros.update(usuario, id, dto);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Borra el rubro', description: '409 si algún gasto lo usa.' })
  remove(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return this.rubros.remove(usuario, id);
  }
}
