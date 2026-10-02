import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';
import { EstadoReserva } from '../../../database/entities';
import { FECHA } from './crear-reserva.dto';

export class ListarReservasQuery {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  amenityId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  consorcioId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  unidadId?: string;

  @ApiPropertyOptional({ enum: EstadoReserva })
  @IsOptional()
  @IsEnum(EstadoReserva)
  estado?: EstadoReserva;

  @ApiPropertyOptional({
    enum: ['proximas', 'pasadas'],
    description: 'Atajo para las solapas del portal: `proximas` es todo lo que todavía no empezó',
  })
  @IsOptional()
  @IsEnum(['proximas', 'pasadas'])
  situacion?: 'proximas' | 'pasadas';

  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @Matches(FECHA, { message: 'desde tiene que tener el formato AAAA-MM-DD' })
  desde?: string;

  @ApiPropertyOptional({ example: '2026-10-31' })
  @IsOptional()
  @Matches(FECHA, { message: 'hasta tiene que tener el formato AAAA-MM-DD' })
  hasta?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite?: number = 20;
}
