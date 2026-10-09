import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

/** A qué se le cobra: la boleta de expensas o la seña de una reserva. Va uno solo. */
export class DestinoPagoDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'La boleta de expensas' })
  @IsOptional()
  @IsUUID()
  boletaId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'La reserva cuya seña se paga' })
  @IsOptional()
  @IsUUID()
  reservaId?: string;
}
