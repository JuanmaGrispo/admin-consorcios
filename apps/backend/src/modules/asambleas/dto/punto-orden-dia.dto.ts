import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { TipoPuntoOrden } from '../../../database/entities';

/** Un punto del orden del día. El número de orden lo da su posición en la lista. */
export class PuntoOrdenDiaDto {
  @ApiProperty({ example: 'Cambio de la bomba de agua' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  titulo: string;

  @ApiPropertyOptional({ example: 'Presupuesto de $ 3.480.000' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descripcion?: string;

  @ApiPropertyOptional({ enum: TipoPuntoOrden, default: TipoPuntoOrden.INFORMATIVO })
  @IsOptional()
  @IsEnum(TipoPuntoOrden)
  tipo?: TipoPuntoOrden;
}
