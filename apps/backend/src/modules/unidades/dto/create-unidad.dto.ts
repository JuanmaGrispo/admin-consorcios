import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
} from 'class-validator';
import { TipoUnidad } from '../../../database/entities';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Espeja las columnas de la tabla `unidad`. Los topes de largo y de decimales
 * son los de la base: validarlos acá devuelve un 400 legible en vez de un 500
 * del driver.
 */
export class CreateUnidadDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  consorcioId: string;

  @ApiProperty({ example: '3º B', description: 'Única dentro del consorcio' })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  etiqueta: string;

  @ApiPropertyOptional({ example: '3' })
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(5)
  piso?: string;

  @ApiPropertyOptional({ example: 'B' })
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(5)
  departamento?: string;

  @ApiPropertyOptional({ enum: TipoUnidad, default: TipoUnidad.DEPARTAMENTO })
  @IsOptional()
  @IsEnum(TipoUnidad)
  tipo?: TipoUnidad;

  @ApiProperty({
    example: 4.5,
    description: 'Porcentaje de participación en las expensas (0 < x ≤ 100)',
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  @Max(100)
  coeficiente: number;

  @ApiPropertyOptional({ example: 62.5 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(999999.99)
  metrosCuadrados?: number;
}
