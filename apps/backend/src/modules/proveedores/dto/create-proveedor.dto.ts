import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Espeja las columnas de la tabla `proveedor`, con sus topes de largo. */
export class CreateProveedorDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Consorcio para el que trabaja. Sin él, el proveedor es compartido por todos y sólo lo puede crear el superadmin.',
  })
  @IsOptional()
  @IsUUID()
  consorcioId?: string;

  @ApiProperty({ example: 'Plomería Rivas SRL' })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  razonSocial: string;

  // La columna es varchar(13): justo el CUIT con guiones.
  @ApiPropertyOptional({ example: '30-71234567-9' })
  @IsOptional()
  @Transform(recortar)
  @Matches(/^\d{2}-\d{8}-\d$/, { message: 'cuit tiene que tener el formato 30-12345678-9' })
  cuit?: string;

  @ApiPropertyOptional({ example: 'Plomería' })
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(60)
  rubro?: string;

  @ApiPropertyOptional({ example: 'contacto@plomeriarivas.com' })
  @IsOptional()
  @Transform(recortar)
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @ApiPropertyOptional({ example: '+54 11 4567-8910' })
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(30)
  telefono?: string;
}
