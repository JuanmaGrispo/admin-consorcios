import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';
import { FECHA } from './crear-reserva.dto';

export class ListarBloqueosQuery {
  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @Matches(FECHA, { message: 'desde tiene que tener el formato AAAA-MM-DD' })
  desde?: string;

  @ApiPropertyOptional({ example: '2026-10-31' })
  @IsOptional()
  @Matches(FECHA, { message: 'hasta tiene que tener el formato AAAA-MM-DD' })
  hasta?: string;
}
