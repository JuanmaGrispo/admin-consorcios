import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsNumber, IsOptional, IsPositive, IsUUID, Max } from 'class-validator';
import { MedioPago } from '../../../database/entities';

/** Los pagos por Mercado Pago entran sólo por su flujo, nunca a mano. */
export const MEDIOS_MANUALES = [MedioPago.TRANSFERENCIA, MedioPago.EFECTIVO, MedioPago.OTRO];

/** Un pago que el administrador registra a mano: transferencia, efectivo, etc. */
export class RegistrarPagoDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  boletaId: string;

  // numeric(14,2)
  @ApiProperty({ example: 45000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(999_999_999_999.99)
  monto: number;

  @ApiProperty({ enum: MEDIOS_MANUALES })
  @IsIn(MEDIOS_MANUALES)
  medio: MedioPago;

  @ApiPropertyOptional({ example: '2026-10-05', description: 'Si no viene, ahora' })
  @IsOptional()
  @IsDateString()
  fechaPago?: string;
}
