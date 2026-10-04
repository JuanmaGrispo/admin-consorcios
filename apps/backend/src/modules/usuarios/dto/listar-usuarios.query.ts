import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { RolUsuario } from '../../../database/entities';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ListarUsuariosQuery {
  @ApiPropertyOptional({ enum: RolUsuario, description: 'Sólo superadmin' })
  @IsOptional()
  @IsEnum(RolUsuario)
  rol?: RolUsuario;

  @ApiPropertyOptional({ format: 'uuid', description: 'Vecinos de ese consorcio' })
  @IsOptional()
  @IsUUID()
  consorcioId?: string;

  @ApiPropertyOptional({ description: 'Busca en nombre, apellido y email' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(recortar)
  buscar?: string;

  @ApiPropertyOptional({
    description: 'Email exacto: para encontrar a un vecino que ya existe y vincularlo',
  })
  @IsOptional()
  @IsEmail({}, { message: 'El email no es válido' })
  @Transform(recortar)
  email?: string;
}
