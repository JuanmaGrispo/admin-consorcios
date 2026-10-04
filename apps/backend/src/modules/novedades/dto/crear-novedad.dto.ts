import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class AdjuntoNovedadDto {
  @ApiProperty({ description: 'La URL que devolvió POST /archivos?destino=novedades' })
  @IsUrl({ require_protocol: true }, { message: 'La url del adjunto no es válida' })
  url: string;

  @ApiPropertyOptional({ example: 'Presupuesto pintura.pdf' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nombre?: string;
}

export class CrearNovedadDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  consorcioId: string;

  @ApiProperty({ example: 'Corte de agua el martes' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  titulo: string;

  @ApiProperty({ example: 'AySA corta el suministro de 9 a 13 por obras en la calle.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  cuerpo: string;

  @ApiPropertyOptional({ default: false, description: 'Queda arriba del muro' })
  @IsOptional()
  @IsBoolean()
  fijada?: boolean;

  @ApiPropertyOptional({ type: [AdjuntoNovedadDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => AdjuntoNovedadDto)
  adjuntos?: AdjuntoNovedadDto[];
}
