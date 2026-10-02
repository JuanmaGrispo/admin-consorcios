import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/** Fecha y hora de pared del edificio, sin offset: el instante lo arma la base. */
export const FECHA_HORA = /^\d{4}-\d{2}-\d{2}[T ]([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export class CrearBloqueoDto {
  @ApiProperty({ example: '2026-10-10T00:00' })
  @Matches(FECHA_HORA, { message: 'desde tiene que tener el formato AAAA-MM-DDTHH:MM' })
  desde: string;

  @ApiProperty({ example: '2026-10-12T23:59' })
  @Matches(FECHA_HORA, { message: 'hasta tiene que tener el formato AAAA-MM-DDTHH:MM' })
  hasta: string;

  @ApiPropertyOptional({ example: 'Pintura del salón' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  motivo?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Cancela las reservas que el bloqueo pisa en vez de rechazar el alta',
  })
  @IsOptional()
  @IsBoolean()
  cancelarReservas?: boolean;
}
