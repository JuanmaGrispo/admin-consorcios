import { ApiProperty } from '@nestjs/swagger';
import { IsUrl } from 'class-validator';

export class CargarActaDto {
  @ApiProperty({ example: 'https://storage.example.com/actas/2026-09-12.pdf' })
  @IsUrl()
  actaUrl: string;
}
