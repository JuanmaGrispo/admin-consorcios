import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PeriodicidadMora } from '../../../database/entities';

/**
 * Espeja las columnas de la tabla `consorcio`. Lo que la base marca NOT NULL y
 * sin default es obligatorio acá; el resto es opcional y, si no viene, queda en
 * el default que define la base.
 */
export class CreateConsorcioDto {
  @ApiProperty({ example: 'Edificio Libertador 1234' })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({ format: 'uuid', description: 'Usuario administrador del consorcio' })
  @IsUUID()
  administradorId: string;

  // ── Domicilio ──
  @ApiPropertyOptional({ example: 'Av. Libertador' })
  @IsOptional()
  @IsString()
  calle?: string;

  @ApiPropertyOptional({ example: '1234' })
  @IsOptional()
  @IsString()
  numero?: string;

  @ApiPropertyOptional({ example: 'Belgrano' })
  @IsOptional()
  @IsString()
  barrio?: string;

  @ApiPropertyOptional({ example: 'CABA' })
  @IsOptional()
  @IsString()
  ciudad?: string;

  @ApiPropertyOptional({ example: 'Buenos Aires' })
  @IsOptional()
  @IsString()
  provincia?: string;

  @ApiPropertyOptional({ example: 'C1426' })
  @IsOptional()
  @IsString()
  cp?: string;

  // ── Datos fiscales ──
  @ApiPropertyOptional({ example: '30-12345678-9' })
  @IsOptional()
  @IsString()
  cuit?: string;

  @ApiPropertyOptional({ example: '0170099220000067797888' })
  @IsOptional()
  @IsString()
  cbu?: string;

  // ── Reglas de liquidación ──
  @ApiPropertyOptional({ example: 10, description: 'Día de vencimiento de la expensa' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  diaVencimiento?: number;

  @ApiPropertyOptional({ example: 2.5, description: 'Tasa de interés por mora (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tasaInteresMora?: number;

  @ApiPropertyOptional({ enum: PeriodicidadMora, example: PeriodicidadMora.MENSUAL })
  @IsOptional()
  @IsEnum(PeriodicidadMora)
  periodicidadMora?: PeriodicidadMora;

  @ApiPropertyOptional({ example: 5, description: 'Porcentaje destinado al fondo de reserva' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  porcentajeFondoReserva?: number;

  @ApiPropertyOptional({ example: 60, description: 'Quórum por defecto para asambleas (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  quorumDefault?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
