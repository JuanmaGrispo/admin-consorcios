import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReemplazarOpcionesDto {
  @ApiProperty({ example: ['Abstención'], description: 'Las opciones no fijas, en orden' })
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(60, { each: true })
  opciones: string[];
}
