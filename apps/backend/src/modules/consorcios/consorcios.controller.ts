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
import { ApiTags } from '@nestjs/swagger';
import { ConsorciosService } from './consorcios.service';
import { CreateConsorcioDto } from './dto/create-consorcio.dto';
import { UpdateConsorcioDto } from './dto/update-consorcio.dto';

@ApiTags('consorcios')
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

  @Post()
  create(@Body() dto: CreateConsorcioDto) {
    return this.consorcios.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConsorcioDto,
  ) {
    return this.consorcios.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.consorcios.remove(id);
  }
}
