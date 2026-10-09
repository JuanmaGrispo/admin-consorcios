import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export const HORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export class CreateAmenityDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  consorcioId: string;

  @ApiProperty({ example: 'SUM', description: 'Único dentro del consorcio' })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nombre: string;

  @ApiPropertyOptional({ example: 'celebration', description: 'Nombre de un Material Symbol' })
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(40)
  icono?: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9999)
  cupoPersonas?: number;

  @ApiPropertyOptional({
    example: 'Música hasta las 01:00. Devolver el SUM limpio.',
    description: 'Las reglas en texto libre: el vecino las ve antes de confirmar',
  })
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(4000)
  reglamento?: string | null;

  @ApiPropertyOptional({ example: '08:00', default: '08:00:00' })
  @IsOptional()
  @Matches(HORA, { message: 'horaApertura tiene que tener el formato HH:MM' })
  horaApertura?: string;

  @ApiPropertyOptional({ example: '22:00', default: '22:00:00' })
  @IsOptional()
  @Matches(HORA, { message: 'horaCierre tiene que tener el formato HH:MM' })
  horaCierre?: string;

  @ApiPropertyOptional({ example: 24, default: 0, maximum: 720 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(720)
  anticipacionMinimaHoras?: number;

  @ApiPropertyOptional({ example: 6, description: 'Sin tope si no se indica' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  duracionMaximaHoras?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  requiereAprobacion?: boolean;

  // `ck_amenity_sena` en la base exige >= 0, y 0 es el default: sin seña.
  @ApiPropertyOptional({ example: 15000, default: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  montoSena?: number;

  @ApiPropertyOptional({ example: 7, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  diasDevolucionSena?: number;

  @ApiPropertyOptional({
    default: false,
    description: 'Si está en true, el vecino con expensas vencidas no puede reservar',
  })
  @IsOptional()
  @IsBoolean()
  bloqueaConDeuda?: boolean;
}
