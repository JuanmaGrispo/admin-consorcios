import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PrioridadReclamo } from '../../../database/entities';

export class AdjuntoDto {
  @ApiProperty({ example: 'https://…/reclamos/foto-1.jpg' })
  @IsUrl({ require_protocol: true }, { message: 'La url del adjunto no es válida' })
  url: string;

  @ApiPropertyOptional({ example: 'foto baño 3ºB' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nombre?: string;
}

export class CrearReclamoDto {
  @ApiProperty({ format: 'uuid', description: 'Categoría del reclamo' })
  @IsUUID()
  categoriaId: string;

  @ApiProperty({
    example: 'Hay una pérdida en la canilla del baño desde el domingo.',
    minLength: 10,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'Contá un poco más: al menos 10 caracteres' })
  @MaxLength(2000)
  descripcion: string;

  /**
   * Opcional para el vecino: si está vinculado a una sola unidad se infiere.
   * El administrador la tiene que indicar siempre, porque no es vecino de
   * ninguna. El consorcio NO se recibe: se deriva de la unidad, así no pueden
   * llegar desalineados.
   */
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  unidadId?: string;

  /** Sólo la toma el administrador; al vecino se le ignora (queda en MEDIA). */
  @ApiPropertyOptional({ enum: PrioridadReclamo })
  @IsOptional()
  @IsEnum(PrioridadReclamo)
  prioridad?: PrioridadReclamo;

  // La base limita a 5 (CHECK orden entre 0 y 4) y el prototipo muestra
  // "Fotos · 2 de 5".
  @ApiPropertyOptional({ type: [AdjuntoDto], maxItems: 5 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5, { message: 'Hasta 5 fotos por reclamo' })
  @ValidateNested({ each: true })
  @Type(() => AdjuntoDto)
  adjuntos?: AdjuntoDto[];
}
