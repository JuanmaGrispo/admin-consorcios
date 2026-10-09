import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateVotacionDto } from './create-votacion.dto';

/**
 * Ni el consorcio ni la asamblea o su punto se cambian: definen dónde se
 * vota. Las opciones se reemplazan aparte, con `PUT /votaciones/:id/opciones`.
 */
export class UpdateVotacionDto extends PartialType(
  OmitType(CreateVotacionDto, ['consorcioId', 'puntoOrdenDiaId', 'asambleaId', 'opciones'] as const),
) {}
