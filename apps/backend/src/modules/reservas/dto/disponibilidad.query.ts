import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';
import { FECHA } from './crear-reserva.dto';

export class DisponibilidadQuery {
  @ApiProperty({ example: '2026-10-05' })
  @Matches(FECHA, { message: 'fecha tiene que tener el formato AAAA-MM-DD' })
  fecha: string;
}
