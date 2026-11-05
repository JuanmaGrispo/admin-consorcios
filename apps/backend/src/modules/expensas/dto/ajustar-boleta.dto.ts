import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { MaxDecimales } from '../../../core/max-decimales';

export class AjustarBoletaDto {
  @ApiProperty({
    example: -1500,
    description: 'Positivo suma, negativo descuenta. 0 quita el ajuste.',
  })
  @IsNumber()
  @MaxDecimales(2)
  @Min(-999_999_999_999.99)
  @Max(999_999_999_999.99)
  ajusteManual: number;

  @ApiPropertyOptional({
    example: 'Bonificación por arreglo a cargo del vecino',
    description: 'Obligatorio si el ajuste no es 0',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(200)
  motivoAjuste?: string;
}
