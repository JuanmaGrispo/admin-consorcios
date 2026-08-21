import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateConsorcioDto {
  @ApiProperty({ example: 'Edificio Libertador 1234' })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({ example: 'Av. Libertador 1234, CABA' })
  @IsString()
  @IsNotEmpty()
  direccion: string;

  @ApiProperty({ example: 24, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  unidades?: number;
}
