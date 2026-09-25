import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { NaturalezaGasto } from '../../../database/entities';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateRubroGastoDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Consorcio al que pertenece. Sin él, el rubro es compartido por todos y sólo lo puede crear el superadmin.',
  })
  @IsOptional()
  @IsUUID()
  consorcioId?: string;

  @ApiProperty({ example: 'Sueldos y cargas sociales' })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nombre: string;

  @ApiPropertyOptional({ example: 'badge', description: 'Nombre del ícono de Material Symbols' })
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(40)
  icono?: string;

  @ApiPropertyOptional({
    enum: NaturalezaGasto,
    default: NaturalezaGasto.ORDINARIO,
    description: 'La que toman por defecto los gastos de este rubro',
  })
  @IsOptional()
  @IsEnum(NaturalezaGasto)
  naturaleza?: NaturalezaGasto;
}
