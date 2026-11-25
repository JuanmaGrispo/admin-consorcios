import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { BooleanoEstricto } from '../../../core/booleano-estricto';

export class UpdateUsuarioDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  apellido?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail({}, { message: 'El email no es válido' })
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  dni?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;

  @ApiPropertyOptional({ description: 'Sólo superadmin. `false` da de baja la cuenta.' })
  @IsOptional()
  @BooleanoEstricto()
  activo?: boolean;
}
