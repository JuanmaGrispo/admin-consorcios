import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

export class PanelQuery {
  @ApiPropertyOptional({
    example: '2026-08',
    description: 'Período (AAAA-MM). Sin esto, el último que emitió alguno de sus consorcios.',
  })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'periodo tiene que tener el formato AAAA-MM' })
  periodo?: string;
}
