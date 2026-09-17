import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AsignarProveedorDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  proveedorId: string;

  @ApiPropertyOptional({ example: 'Coordinan la visita para el jueves.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  mensaje?: string;
}
