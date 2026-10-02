import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateAmenityDto } from './create-amenity.dto';

export class UpdateAmenityDto extends PartialType(
  OmitType(CreateAmenityDto, ['consorcioId'] as const),
) {
  @ApiPropertyOptional({
    description: 'Dar de baja o reactivar. No se borran: las reservas los referencian.',
  })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
