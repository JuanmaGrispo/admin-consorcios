import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { EstadoVotacion } from '../../../database/entities';

export class ListarVotacionesQuery {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  consorcioId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  asambleaId?: string;

  @ApiPropertyOptional({ enum: EstadoVotacion })
  @IsOptional()
  @IsEnum(EstadoVotacion)
  estado?: EstadoVotacion;
}
