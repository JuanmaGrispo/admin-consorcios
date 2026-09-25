import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { VinculoUnidad } from '../../../database/entities';

export class VincularUsuarioDto {
  @ApiProperty({ format: 'uuid', description: 'Usuario activo con rol VECINO' })
  @IsUUID()
  usuarioId: string;

  @ApiProperty({ enum: VinculoUnidad })
  @IsEnum(VinculoUnidad)
  vinculo: VinculoUnidad;

  @ApiPropertyOptional({
    default: false,
    description: 'Responsable principal de la unidad. Hay uno solo vigente por unidad.',
  })
  @IsOptional()
  @IsBoolean()
  esTitular?: boolean;

  @ApiPropertyOptional({ example: '2026-03-01', description: 'Si no viene, hoy' })
  @IsOptional()
  @IsDateString({ strict: true })
  desde?: string;
}
