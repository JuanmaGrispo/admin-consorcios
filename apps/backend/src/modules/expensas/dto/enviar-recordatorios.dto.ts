import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { SITUACIONES, type SituacionBoleta } from './listar-boletas.query';

/**
 * A quiénes avisarles que deben. El alcance se indica igual que en la grilla:
 * una liquidación, o un consorcio y opcionalmente un período. Sólo salen
 * avisos por boletas con saldo: recordarle a quien ya pagó es la forma más
 * rápida de que el vecino deje de leer los mails del consorcio.
 */
export class EnviarRecordatoriosDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  liquidacionId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  consorcioId?: string;

  @ApiPropertyOptional({ example: '2026-08' })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'periodo tiene que tener el formato AAAA-MM' })
  periodo?: string;

  @ApiPropertyOptional({
    enum: SITUACIONES.filter((s) => s !== 'pagados'),
    description: 'Si no viene, a todas las que tengan saldo',
  })
  @IsOptional()
  @IsEnum(['pendientes', 'vencidos'])
  situacion?: Exclude<SituacionBoleta, 'pagados'>;

  @ApiPropertyOptional({
    description: 'Se agrega al final del aviso',
    example: 'Recordá que a partir del 15 corren intereses.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  mensaje?: string;
}
