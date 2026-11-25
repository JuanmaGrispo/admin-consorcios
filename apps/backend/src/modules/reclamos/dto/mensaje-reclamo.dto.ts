import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { BooleanoEstricto } from '../../../core/booleano-estricto';

export class MensajeReclamoDto {
  @ApiProperty({ example: 'Visita del plomero coordinada para el jueves de 9 a 12.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  mensaje: string;

  /**
   * Una nota interna queda en la timeline del administrador pero el vecino no
   * la ve. Sólo el administrador puede marcarla: para un vecino, escribir algo
   * que él mismo no vería no tiene sentido.
   */
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @BooleanoEstricto()
  interna?: boolean;
}
