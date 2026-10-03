import { ApiProperty } from '@nestjs/swagger';
import { IsUrl } from 'class-validator';

export class CargarActaDto {
  @ApiProperty({ description: 'La URL que devolvió POST /archivos?destino=actas' })
  @IsUrl()
  actaUrl: string;
}
