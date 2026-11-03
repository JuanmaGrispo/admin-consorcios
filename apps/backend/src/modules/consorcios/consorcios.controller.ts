import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Res,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { etagDe, exigirIfMatch } from '../../core/http/contratos-rest';
import { RolUsuario } from '../../database/entities';
import type { UsuarioActual as Usuario } from '../auth/auth.types';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import { ConsorciosService } from './consorcios.service';
import { CreateConsorcioDto } from './dto/create-consorcio.dto';
import { UpdateConsorcioDto } from './dto/update-consorcio.dto';

@ApiTags('consorcios')
@ApiBearerAuth()
@Controller('consorcios')
export class ConsorciosController {
  constructor(private readonly consorcios: ConsorciosService) {}

  @Get()
  findAll(@UsuarioActual() usuario: Usuario) {
    return this.consorcios.findAll(usuario);
  }

  @Get(':id')
  async findOne(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string, @Res({ passthrough: true }) res: Response) {
    const consorcio = await this.consorcios.findVisible(usuario, id);
    res.setHeader('ETag', etagDe(consorcio));
    return consorcio;
  }

  // Crear, modificar y borrar consorcios es del dueño del SaaS, no de los
  // administradores de cada edificio.
  @Roles(RolUsuario.SUPER_ADMIN)
  @Post()
  create(@Body() dto: CreateConsorcioDto) {
    return this.consorcios.create(dto);
  }

  @Roles(RolUsuario.SUPER_ADMIN)
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConsorcioDto,
    @Headers('if-match') ifMatch: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const consorcio = await this.consorcios.update(id, dto, exigirIfMatch(ifMatch));
    res.setHeader('ETag', etagDe(consorcio));
    return consorcio;
  }

  @Roles(RolUsuario.SUPER_ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.consorcios.remove(id);
  }
}
