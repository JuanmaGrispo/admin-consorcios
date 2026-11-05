import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { booleanoDeQuery } from '../../../core/booleano-de-query';
import { PAGINA_MAXIMA } from '../../../core/http/contratos-rest';

export class ListarNotificacionesQuery {
  @ApiPropertyOptional({ description: 'Sólo las que no leyó' })
  @IsOptional()
  @Transform(booleanoDeQuery)
  @IsBoolean()
  soloNoLeidas?: boolean;

  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: PAGINA_MAXIMA })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGINA_MAXIMA)
  pagina?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite?: number = 20;
}
