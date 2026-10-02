import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ModalidadAsamblea, TipoAsamblea } from '../../../database/entities';
import { PuntoOrdenDiaDto } from './punto-orden-dia.dto';

export class CreateAsambleaDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  consorcioId: string;

  @ApiProperty({ example: 'Asamblea ordinaria · 2º semestre 2026' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  titulo: string;

  @ApiPropertyOptional({ enum: TipoAsamblea, default: TipoAsamblea.ORDINARIA })
  @IsOptional()
  @IsEnum(TipoAsamblea)
  tipo?: TipoAsamblea;

  @ApiPropertyOptional({ enum: ModalidadAsamblea, default: ModalidadAsamblea.PRESENCIAL })
  @IsOptional()
  @IsEnum(ModalidadAsamblea)
  modalidad?: ModalidadAsamblea;

  @ApiProperty({ example: '2026-11-12T19:00:00-03:00', description: 'Fecha y hora, tiene que ser futura' })
  @IsDateString()
  fechaHora: string;

  @ApiPropertyOptional({ example: 'SUM del edificio', description: 'Obligatorio si es presencial o híbrida' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  lugar?: string | null;

  @ApiPropertyOptional({ example: 'https://meet.example.com/abc', description: 'Obligatorio si es digital o híbrida' })
  @IsOptional()
  @IsUrl()
  linkVideollamada?: string | null;

  @ApiPropertyOptional({ example: 60, default: 60, description: 'Porcentaje de coeficientes para sesionar' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  quorumRequerido?: number;

  @ApiPropertyOptional({ type: [PuntoOrdenDiaDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PuntoOrdenDiaDto)
  puntos?: PuntoOrdenDiaDto[];
}
