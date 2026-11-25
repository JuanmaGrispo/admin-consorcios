import { ApiProperty } from '@nestjs/swagger';
import { BooleanoEstricto } from '../../../core/booleano-estricto';

export class HabilitadoDto {
  @ApiProperty()
  @BooleanoEstricto()
  habilitado: boolean;
}
