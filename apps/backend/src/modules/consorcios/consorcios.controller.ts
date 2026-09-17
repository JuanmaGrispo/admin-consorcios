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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '../../database/entities';
import { Roles } from '../auth/decorators/roles.decorator';
import { ConsorciosService } from './consorcios.service';
import { CreateConsorcioDto } from './dto/create-consorcio.dto';
import { UpdateConsorcioDto } from './dto/update-consorcio.dto';

@ApiTags('consorcios')
@ApiBearerAuth()
@Controller('consorcios')
export class ConsorciosController {
  constructor(private readonly consorcios: ConsorciosService) {}

  @Get()
  findAll() {
    return this.consorcios.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.consorcios.findOne(id);
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
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConsorcioDto,
  ) {
    return this.consorcios.update(id, dto);
  }

  @Roles(RolUsuario.SUPER_ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.consorcios.remove(id);
  }
}
