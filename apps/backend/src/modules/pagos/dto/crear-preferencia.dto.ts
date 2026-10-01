import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CrearPreferenciaDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  boletaId: string;
}
