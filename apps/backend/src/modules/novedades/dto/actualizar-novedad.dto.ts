import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { BooleanoEstricto } from '../../../core/booleano-estricto';

export class ActualizarNovedadDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  titulo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  cuerpo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @BooleanoEstricto()
  fijada?: boolean;

  @ApiPropertyOptional({ description: '`false` la saca del muro' })
  @IsOptional()
  @BooleanoEstricto()
  activa?: boolean;
}
