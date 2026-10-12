import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { booleanoDeQuery } from '../../../core/booleano-de-query';
import { FormaConteo, PadronVotacion } from '../../../database/entities';

export class VistaPadronQuery {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  consorcioId: string;

  @ApiPropertyOptional({ enum: PadronVotacion, default: PadronVotacion.SOLO_PROPIETARIOS })
  @IsOptional()
  @IsEnum(PadronVotacion)
  padron?: PadronVotacion;

  @ApiPropertyOptional({ enum: FormaConteo, default: FormaConteo.POR_COEFICIENTE })
  @IsOptional()
  @IsEnum(FormaConteo)
  formaConteo?: FormaConteo;

  @ApiPropertyOptional({
    default: false,
    description: 'Si la votación bloquearía a las unidades con expensas vencidas: agrega cuáles serían',
  })
  @IsOptional()
  @Transform(booleanoDeQuery)
  @IsBoolean()
  bloqueaConDeuda?: boolean;
}
