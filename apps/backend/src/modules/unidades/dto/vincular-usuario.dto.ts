import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { VinculoUnidad } from '../../../database/entities';
import { NuevoVecinoDto } from '../../usuarios/dto/nuevo-vecino.dto';

/** Va `usuarioId` o `nuevoUsuario`, uno de los dos. */
export class VincularUsuarioDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Vecino que ya tiene cuenta' })
  @IsOptional()
  @IsUUID()
  usuarioId?: string;

  @ApiPropertyOptional({ type: NuevoVecinoDto, description: 'Lo da de alta y lo vincula en un paso' })
  @IsOptional()
  @ValidateNested()
  @Type(() => NuevoVecinoDto)
  nuevoUsuario?: NuevoVecinoDto;

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
