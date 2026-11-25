import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { BooleanoEstricto } from '../../../core/booleano-estricto';

export class FeedbackDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  interaccion_id: string;

  @ApiProperty({ description: 'Pulgar arriba (true) o abajo (false)' })
  @BooleanoEstricto()
  util: boolean;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comentario?: string;
}
