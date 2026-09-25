import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { EstadoLiquidacion } from '../../../database/entities';

export class ListarLiquidacionesQuery {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  consorcioId?: string;

  @ApiPropertyOptional({ enum: EstadoLiquidacion })
  @IsOptional()
  @IsEnum(EstadoLiquidacion)
  estado?: EstadoLiquidacion;
}
