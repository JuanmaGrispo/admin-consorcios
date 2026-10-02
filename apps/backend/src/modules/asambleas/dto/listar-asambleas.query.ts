import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { EstadoAsamblea } from '../../../database/entities';

export class ListarAsambleasQuery {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  consorcioId?: string;

  @ApiPropertyOptional({ enum: EstadoAsamblea })
  @IsOptional()
  @IsEnum(EstadoAsamblea)
  estado?: EstadoAsamblea;

  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  anio?: number;
}
