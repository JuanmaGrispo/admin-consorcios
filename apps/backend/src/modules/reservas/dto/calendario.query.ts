import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';
import { FECHA } from './crear-reserva.dto';

export class CalendarioQuery {
  @ApiProperty({ example: '2026-09-01' })
  @Matches(FECHA, { message: 'desde tiene que tener el formato AAAA-MM-DD' })
  desde: string;

  @ApiProperty({ example: '2026-09-30' })
  @Matches(FECHA, { message: 'hasta tiene que tener el formato AAAA-MM-DD' })
  hasta: string;
}
