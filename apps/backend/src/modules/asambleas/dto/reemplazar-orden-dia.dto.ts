import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import { PuntoOrdenDiaDto } from './punto-orden-dia.dto';

export class ReemplazarOrdenDiaDto {
  @ApiProperty({ type: [PuntoOrdenDiaDto], description: 'La lista completa, en orden' })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PuntoOrdenDiaDto)
  puntos: PuntoOrdenDiaDto[];
}
