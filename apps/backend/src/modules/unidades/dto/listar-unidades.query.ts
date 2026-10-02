import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { booleanoDeQuery } from '../../../core/booleano-de-query';

export class ListarUnidadesQuery {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  consorcioId?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(booleanoDeQuery)
  @IsBoolean()
  incluirInactivas?: boolean;
}
