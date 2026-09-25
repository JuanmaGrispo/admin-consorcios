import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateCategoriaReclamoDto } from './create-categoria-reclamo.dto';

/** El alcance (de un consorcio o compartida) no se cambia, igual que en proveedores. */
export class UpdateCategoriaReclamoDto extends PartialType(
  OmitType(CreateCategoriaReclamoDto, ['consorcioId'] as const),
) {}
