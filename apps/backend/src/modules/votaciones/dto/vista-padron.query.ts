import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
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
}
