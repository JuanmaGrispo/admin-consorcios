import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { EstadoReclamo } from '../../../database/entities';

export class CambiarEstadoDto {
  @ApiProperty({ enum: EstadoReclamo })
  @IsEnum(EstadoReclamo)
  estado: EstadoReclamo;

  @ApiPropertyOptional({ example: 'Se cambió el flotante y no pierde más.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  mensaje?: string;
}
