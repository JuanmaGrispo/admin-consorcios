import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID, Matches } from 'class-validator';
import { CriterioProrrateo } from '../../../database/entities';

export class CreateLiquidacionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  consorcioId: string;

  @ApiProperty({ example: '2026-09', description: 'Mes de los gastos (AAAA-MM)' })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'periodo tiene que tener el formato AAAA-MM' })
  periodo: string;

  @ApiPropertyOptional({ enum: CriterioProrrateo, default: CriterioProrrateo.COEFICIENTE })
  @IsOptional()
  @IsEnum(CriterioProrrateo)
  criterioProrrateo?: CriterioProrrateo;

  @ApiPropertyOptional({
    example: '2026-10-10',
    description:
      'Si no viene: el día de vencimiento del consorcio en el mes siguiente al período',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  fechaVencimiento?: string;
}
