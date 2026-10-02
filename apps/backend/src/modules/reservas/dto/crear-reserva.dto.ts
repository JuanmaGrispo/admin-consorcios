import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { HORA } from './create-amenity.dto';

export const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CrearReservaDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  amenityId: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Obligatorio para quien administra. El vecino con una sola unidad puede omitirlo.',
  })
  @IsOptional()
  @IsUUID()
  unidadId?: string;

  @ApiProperty({ example: '2026-10-05' })
  @Matches(FECHA, { message: 'fecha tiene que tener el formato AAAA-MM-DD' })
  fecha: string;

  @ApiProperty({ example: '12:00' })
  @Matches(HORA, { message: 'horaInicio tiene que tener el formato HH:MM' })
  horaInicio: string;

  @ApiProperty({ example: '16:00' })
  @Matches(HORA, { message: 'horaFin tiene que tener el formato HH:MM' })
  horaFin: string;

  @ApiPropertyOptional({ example: 'Cumpleaños' })
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(120)
  motivo?: string;
}
