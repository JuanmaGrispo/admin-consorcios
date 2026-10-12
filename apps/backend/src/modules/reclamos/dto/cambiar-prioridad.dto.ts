import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { PrioridadReclamo } from '../../../database/entities';

export class CambiarPrioridadDto {
  @ApiProperty({ enum: PrioridadReclamo })
  @IsEnum(PrioridadReclamo)
  prioridad: PrioridadReclamo;
}
