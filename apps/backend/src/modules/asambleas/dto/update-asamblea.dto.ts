import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateAsambleaDto } from './create-asamblea.dto';

/**
 * El consorcio no se cambia: si se cargó mal, se borra el borrador y se crea
 * otra. El orden del día se reemplaza aparte, con `PUT /asambleas/:id/orden-dia`.
 */
export class UpdateAsambleaDto extends PartialType(
  OmitType(CreateAsambleaDto, ['consorcioId', 'puntos'] as const),
) {}
