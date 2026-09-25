import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { NaturalezaGasto } from '../../../database/entities';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Espeja las columnas de `gasto` que carga el administrador. */
export class CreateGastoDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  rubroId: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  proveedorId?: string;

  @ApiProperty({ example: 'Abono mensual ascensores' })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  descripcion: string;

  // numeric(14,2)
  @ApiProperty({ example: 185000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(999_999_999_999.99)
  monto: number;

  @ApiPropertyOptional({
    enum: NaturalezaGasto,
    description: 'Si no viene, la del rubro',
  })
  @IsOptional()
  @IsEnum(NaturalezaGasto)
  naturaleza?: NaturalezaGasto;

  @ApiPropertyOptional({ example: 'https://…/factura-0001.pdf' })
  @IsOptional()
  @IsUrl()
  comprobanteUrl?: string;

  @ApiPropertyOptional({ example: 'A-0001-00012345' })
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(50)
  comprobanteNumero?: string;

  @ApiPropertyOptional({ example: 2, description: 'Para un gasto en cuotas: cuál es esta' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999)
  cuotaNumero?: number;

  @ApiPropertyOptional({ example: 6, description: 'Para un gasto en cuotas: cuántas son' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999)
  cuotaTotal?: number;
}
