import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, ValidateNested } from 'class-validator';
import { CanalNotificacion, CategoriaNotificacion } from '../../../database/entities';

export class PreferenciaDto {
  @ApiProperty({ enum: CanalNotificacion })
  @IsEnum(CanalNotificacion)
  canal: CanalNotificacion;

  @ApiProperty({ enum: CategoriaNotificacion })
  @IsEnum(CategoriaNotificacion)
  categoria: CategoriaNotificacion;

  @ApiProperty()
  @IsBoolean()
  habilitado: boolean;
}

/** Sólo lo que cambia: lo que no viene queda como estaba. */
export class ActualizarPreferenciasDto {
  @ApiProperty({ type: [PreferenciaDto] })
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => PreferenciaDto)
  preferencias: PreferenciaDto[];
}
