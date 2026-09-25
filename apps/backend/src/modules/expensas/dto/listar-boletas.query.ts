import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { EstadoBoleta } from '../../../database/entities';

export class ListarBoletasQuery {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  liquidacionId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  unidadId?: string;

  @ApiPropertyOptional({ enum: EstadoBoleta })
  @IsOptional()
  @IsEnum(EstadoBoleta)
  estado?: EstadoBoleta;
}
