import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class VotarDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  opcionId: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Sólo si vota por más de una unidad' })
  @IsOptional()
  @IsUUID()
  unidadId?: string;
}
