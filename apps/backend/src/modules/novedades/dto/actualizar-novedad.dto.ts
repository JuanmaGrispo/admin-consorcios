import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ActualizarNovedadDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  titulo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  cuerpo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  fijada?: boolean;

  @ApiPropertyOptional({ description: '`false` la saca del muro' })
  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
