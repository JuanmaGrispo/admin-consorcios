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
import { CategoriasReclamoService } from './categorias-reclamo.service';
import { CreateCategoriaReclamoDto } from './dto/create-categoria-reclamo.dto';
import { UpdateCategoriaReclamoDto } from './dto/update-categoria-reclamo.dto';

/**
 * Leer es para cualquier logueado: el vecino las necesita para el selector
 * del alta de reclamo. Gestionarlas es del administrador.
 */
@ApiTags('categorias-reclamo')
@ApiBearerAuth()
@Controller('categorias-reclamo')
export class CategoriasReclamoController {
  constructor(private readonly categorias: CategoriasReclamoService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista categorías',
    description: 'Con `consorcioId`, las de ese consorcio más las compartidas.',
  })
  @ApiQuery({ name: 'consorcioId', required: false, format: 'uuid' })
  listar(@Query('consorcioId', new ParseUUIDPipe({ optional: true })) consorcioId?: string) {
    return this.categorias.listar(consorcioId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.categorias.findOne(id);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Post()
  @ApiOperation({
    summary: 'Alta de categoría',
    description: 'Sin `consorcioId` es compartida por todos los consorcios: sólo superadmin.',
  })
  create(@UsuarioActual() usuario: Usuario, @Body() dto: CreateCategoriaReclamoDto) {
    return this.categorias.create(usuario, dto);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Patch(':id')
  update(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoriaReclamoDto,
  ) {
    return this.categorias.update(usuario, id, dto);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Borra la categoría', description: '409 si algún reclamo la usa.' })
  remove(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return this.categorias.remove(usuario, id);
  }
}
