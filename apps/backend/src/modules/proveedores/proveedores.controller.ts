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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '../../database/entities';
import type { UsuarioActual as Usuario } from '../auth/auth.types';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import { CreateProveedorDto } from './dto/create-proveedor.dto';
import { ListarProveedoresQuery } from './dto/listar-proveedores.query';
import { UpdateProveedorDto } from './dto/update-proveedor.dto';
import { ProveedoresService } from './proveedores.service';

/** Todo del administrador: el vecino ve el proveedor dentro de su reclamo. */
@ApiTags('proveedores')
@ApiBearerAuth()
@Roles(RolUsuario.ADMINISTRADOR)
@Controller('proveedores')
export class ProveedoresController {
  constructor(private readonly proveedores: ProveedoresService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista proveedores',
    description: 'Con `consorcioId`, los de ese consorcio más los compartidos.',
  })
  listar(@Query() query: ListarProveedoresQuery) {
    return this.proveedores.listar(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.proveedores.findOne(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Alta de proveedor',
    description: 'Sin `consorcioId` es compartido por todos los consorcios: sólo superadmin.',
  })
  create(@UsuarioActual() usuario: Usuario, @Body() dto: CreateProveedorDto) {
    return this.proveedores.create(usuario, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Edita el proveedor',
    description: 'Con `activo: false` se da de baja. No hay DELETE: gastos y reclamos lo referencian.',
  })
  update(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProveedorDto,
  ) {
    return this.proveedores.update(usuario, id, dto);
  }
}
