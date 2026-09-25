import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateCategoriaReclamoDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Consorcio al que pertenece. Sin él, la categoría es compartida por todos y sólo la puede crear el superadmin.',
  })
  @IsOptional()
  @IsUUID()
  consorcioId?: string;

  @ApiProperty({ example: 'Gas' })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  nombre: string;

  @ApiPropertyOptional({
    example: 'local_fire_department',
    description: 'Nombre del ícono de Material Symbols',
  })
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(40)
  icono?: string;
}
