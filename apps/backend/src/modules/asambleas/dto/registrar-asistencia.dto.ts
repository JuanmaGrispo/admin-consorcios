import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { EstadoAsistencia } from '../../../database/entities';

export class RegistrarAsistenciaDto {
  @ApiProperty({ enum: EstadoAsistencia })
  @IsEnum(EstadoAsistencia)
  estado: EstadoAsistencia;

  @ApiPropertyOptional({ format: 'uuid', description: 'Obligatorio con CON_PODER: la unidad que la representa' })
  @IsOptional()
  @IsUUID()
  apoderadoUnidadId?: string;
}
