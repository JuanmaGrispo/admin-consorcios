import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateLiquidacionDto } from './create-liquidacion.dto';

/**
 * Consorcio y período no se cambian: son la identidad de la liquidación (UNIQUE
 * en la base). Si se cargó mal el período, se borra el borrador y se crea otra.
 */
export class UpdateLiquidacionDto extends PartialType(
  OmitType(CreateLiquidacionDto, ['consorcioId', 'periodo'] as const),
) {}
