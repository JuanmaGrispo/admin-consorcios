import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { booleanoDeQuery } from '../../../core/booleano-de-query';

export class ListarNotificacionesQuery {
  @ApiPropertyOptional({ description: 'Sólo las que no leyó' })
  @IsOptional()
  @Transform(booleanoDeQuery)
  @IsBoolean()
  soloNoLeidas?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite?: number = 20;
}
