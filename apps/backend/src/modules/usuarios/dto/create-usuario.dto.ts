import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { RolUsuario } from '../../../database/entities';

export class CreateUsuarioDto {
  @ApiProperty({ example: 'Carla' })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({ example: 'Méndez' })
  @IsString()
  @IsNotEmpty()
  apellido: string;

  @ApiProperty({ example: 'carla.mendez@administracion.com' })
  @IsEmail({}, { message: 'El email no es válido' })
  email: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'La password tiene que tener al menos 8 caracteres' })
  password: string;

  // SUPER_ADMIN queda afuera a propósito: el dueño de la plataforma no se crea
  // por API, se crea por consola (pnpm back usuario:crear).
  @ApiPropertyOptional({
    enum: [RolUsuario.ADMINISTRADOR, RolUsuario.VECINO],
    default: RolUsuario.ADMINISTRADOR,
  })
  @IsOptional()
  @IsEnum(RolUsuario)
  @IsIn([RolUsuario.ADMINISTRADOR, RolUsuario.VECINO], {
    message: 'Por API solo se crean ADMINISTRADOR o VECINO',
  })
  rol?: RolUsuario;
}
