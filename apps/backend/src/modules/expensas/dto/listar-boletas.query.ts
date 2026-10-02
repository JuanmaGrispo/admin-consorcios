import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { EstadoBoleta } from '../../../database/entities';

/**
 * Las solapas de la grilla de cobranzas. No son lo mismo que `estado`: una
 * boleta PARCIAL sigue estando pendiente, y el administrador la quiere ver
 * junto con las que no pagaron nada.
 */
export type SituacionBoleta = 'pagados' | 'pendientes' | 'vencidos';

export const SITUACIONES: SituacionBoleta[] = ['pagados', 'pendientes', 'vencidos'];

export class ListarBoletasQuery {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  liquidacionId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Todas las boletas del consorcio' })
  @IsOptional()
  @IsUUID()
  consorcioId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  unidadId?: string;

  @ApiPropertyOptional({ example: '2026-08', description: 'Período de la liquidación (AAAA-MM)' })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'periodo tiene que tener el formato AAAA-MM' })
  periodo?: string;

  @ApiPropertyOptional({ enum: EstadoBoleta })
  @IsOptional()
  @IsEnum(EstadoBoleta)
  estado?: EstadoBoleta;

  @ApiPropertyOptional({
    enum: SITUACIONES,
    description: '`pendientes` incluye las parciales: lo que importa es que tienen saldo',
  })
  @IsOptional()
  @IsEnum(SITUACIONES)
  situacion?: SituacionBoleta;

  @ApiPropertyOptional({ description: 'Busca por etiqueta de la unidad o nombre del vecino' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  buscar?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number = 1;

  // Mismo tope que reclamos: sin él, un `limite=100000` voltea la API.
  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite?: number = 20;
}
