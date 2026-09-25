import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { booleanoDeQuery } from '../../../core/booleano-de-query';

export class ListarProveedoresQuery {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Los de ese consorcio más los compartidos',
  })
  @IsOptional()
  @IsUUID()
  consorcioId?: string;

  @ApiPropertyOptional({ description: 'Busca en razón social y rubro' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  buscar?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(booleanoDeQuery)
  @IsBoolean()
  incluirInactivos?: boolean;
}
