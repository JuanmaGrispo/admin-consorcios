import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateProveedorDto } from './create-proveedor.dto';

/**
 * El alcance (de un consorcio o compartido) no se cambia: pasar un proveedor
 * compartido a un consorcio lo haría desaparecer de los reclamos y gastos de
 * los demás.
 */
export class UpdateProveedorDto extends PartialType(
  OmitType(CreateProveedorDto, ['consorcioId'] as const),
) {
  @ApiPropertyOptional({
    description: 'Dar de baja o reactivar. No se borran: gastos y reclamos los referencian.',
  })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
