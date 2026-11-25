import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { CreateAmenityDto } from './create-amenity.dto';
import { BooleanoEstricto } from '../../../core/booleano-estricto';

export class UpdateAmenityDto extends PartialType(
  OmitType(CreateAmenityDto, ['consorcioId'] as const),
) {
  @ApiPropertyOptional({
    description: 'Dar de baja o reactivar. No se borran: las reservas los referencian.',
  })
  @IsOptional()
  @BooleanoEstricto()
  activo?: boolean;
}
