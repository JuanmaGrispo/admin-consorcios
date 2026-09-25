import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateUnidadDto } from './create-unidad.dto';

/**
 * El consorcio no se cambia: una unidad no se muda de edificio, y moverla
 * arrastraría boletas y reclamos que quedaron registrados en el otro.
 */
export class UpdateUnidadDto extends PartialType(
  OmitType(CreateUnidadDto, ['consorcioId'] as const),
) {
  @ApiPropertyOptional({
    description: 'Dar de baja o reactivar. Las unidades no se borran: tienen historia.',
  })
  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
