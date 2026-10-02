import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateRubroGastoDto } from './create-rubro-gasto.dto';

/** El alcance (de un consorcio o compartido) no se cambia, igual que en proveedores. */
export class UpdateRubroGastoDto extends PartialType(
  OmitType(CreateRubroGastoDto, ['consorcioId'] as const),
) {}
