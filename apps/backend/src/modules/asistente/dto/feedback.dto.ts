import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class FeedbackDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  interaccion_id: string;

  @ApiProperty({ description: 'Pulgar arriba (true) o abajo (false)' })
  @IsBoolean()
  util: boolean;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comentario?: string;
}
