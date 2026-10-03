import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  MaxLength,
} from 'class-validator';
import {
  CriterioDesempate,
  FormaConteo,
  MayoriaRequerida,
  PadronVotacion,
} from '../../../database/entities';

export class CreateVotacionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  consorcioId: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Punto CON_VOTACION del orden del día. Sin esto, la votación es independiente.',
  })
  @IsOptional()
  @IsUUID()
  puntoOrdenDiaId?: string;

  @ApiProperty({ example: 'Cambio de la bomba de agua' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  titulo: string;

  @ApiPropertyOptional({ example: 'Presupuesto de $ 3.480.000 en 3 cuotas.' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  descripcion?: string | null;

  @ApiPropertyOptional({ description: 'La URL que devolvió POST /archivos?destino=votaciones' })
  @IsOptional()
  @IsUrl()
  adjuntoUrl?: string | null;

  @ApiPropertyOptional({ enum: PadronVotacion, default: PadronVotacion.SOLO_PROPIETARIOS })
  @IsOptional()
  @IsEnum(PadronVotacion)
  padron?: PadronVotacion;

  @ApiPropertyOptional({ enum: FormaConteo, default: FormaConteo.POR_COEFICIENTE })
  @IsOptional()
  @IsEnum(FormaConteo)
  formaConteo?: FormaConteo;

  @ApiPropertyOptional({ enum: MayoriaRequerida, default: MayoriaRequerida.SIMPLE_PRESENTES })
  @IsOptional()
  @IsEnum(MayoriaRequerida)
  mayoria?: MayoriaRequerida;

  @ApiPropertyOptional({ enum: CriterioDesempate, default: CriterioDesempate.RECHAZADA })
  @IsOptional()
  @IsEnum(CriterioDesempate)
  desempate?: CriterioDesempate;

  @ApiPropertyOptional({ default: false, description: 'Sólo de asamblea: votar desde la app antes de que empiece' })
  @IsOptional()
  @IsBoolean()
  permiteVotoAnticipado?: boolean;

  @ApiPropertyOptional({ default: false, description: 'El vecino ve el parcial antes del cierre' })
  @IsOptional()
  @IsBoolean()
  mostrarParcial?: boolean;

  @ApiPropertyOptional({ default: false, description: 'Una unidad con expensas vencidas no vota' })
  @IsOptional()
  @IsBoolean()
  bloqueaConDeuda?: boolean;

  @ApiPropertyOptional({ example: '2026-11-01T09:00:00-03:00', description: 'Obligatoria si es independiente' })
  @IsOptional()
  @IsDateString()
  apertura?: string;

  @ApiPropertyOptional({ example: '2026-11-08T21:00:00-03:00', description: 'Obligatorio si es independiente' })
  @IsOptional()
  @IsDateString()
  cierre?: string;

  @ApiPropertyOptional({
    example: ['Abstención'],
    description: 'Opciones además de "A favor" y "En contra", que siempre están',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(60, { each: true })
  opciones?: string[];
}
