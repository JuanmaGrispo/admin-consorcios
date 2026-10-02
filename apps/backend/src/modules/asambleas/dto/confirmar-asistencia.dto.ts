import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { EstadoAsistencia } from '../../../database/entities';

/** Lo que responde el vecino: "Asisto" o "No puedo". El poder lo registra el admin. */
export const RESPUESTAS_VECINO = [EstadoAsistencia.ASISTE, EstadoAsistencia.NO_ASISTE] as const;

export class ConfirmarAsistenciaDto {
  @ApiProperty({ enum: RESPUESTAS_VECINO })
  @IsIn(RESPUESTAS_VECINO)
  estado: (typeof RESPUESTAS_VECINO)[number];

  @ApiPropertyOptional({ format: 'uuid', description: 'Sólo si tiene más de una unidad en el consorcio' })
  @IsOptional()
  @IsUUID()
  unidadId?: string;
}
