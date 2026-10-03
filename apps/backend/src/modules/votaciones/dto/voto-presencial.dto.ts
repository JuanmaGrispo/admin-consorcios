import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class VotoPresencialDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  opcionId: string;
}
