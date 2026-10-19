import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { booleanoDeQuery } from '../../../core/booleano-de-query';

/** El padrón es de un consorcio: sin él, un administrador con varios mezclaría edificios. */
export class ExportarPadronQuery {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  consorcioId: string;

  @ApiPropertyOptional({ default: false, description: 'Incluye las unidades dadas de baja' })
  @IsOptional()
  @Transform(booleanoDeQuery)
  @IsBoolean()
  incluirInactivas?: boolean;
}
