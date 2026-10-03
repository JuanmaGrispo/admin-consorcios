import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateVotacionDto } from './create-votacion.dto';

/**
 * Ni el consorcio ni el punto del orden del día se cambian: definen dónde se
 * vota. Las opciones se reemplazan aparte, con `PUT /votaciones/:id/opciones`.
 */
export class UpdateVotacionDto extends PartialType(
  OmitType(CreateVotacionDto, ['consorcioId', 'puntoOrdenDiaId', 'opciones'] as const),
) {}
