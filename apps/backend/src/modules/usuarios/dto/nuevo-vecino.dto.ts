import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class NuevoVecinoDto {
  @ApiProperty({ example: 'Julieta' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nombre: string;

  @ApiProperty({ example: 'Sosa' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  apellido: string;

  @ApiProperty({ example: 'julieta.sosa@mail.com' })
  @IsEmail({}, { message: 'El email no es válido' })
  email: string;

  @ApiProperty({ minLength: 8, description: 'La inicial: el vecino la cambia desde su perfil' })
  @IsString()
  @MinLength(8, { message: 'La password tiene que tener al menos 8 caracteres' })
  password: string;

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
}
