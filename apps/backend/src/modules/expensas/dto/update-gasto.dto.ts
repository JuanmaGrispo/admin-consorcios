import { PartialType } from '@nestjs/swagger';
import { CreateGastoDto } from './create-gasto.dto';

export class UpdateGastoDto extends PartialType(CreateGastoDto) {}
