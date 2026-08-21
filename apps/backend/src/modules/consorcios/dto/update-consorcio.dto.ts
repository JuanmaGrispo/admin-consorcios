import { PartialType } from '@nestjs/swagger';
import { CreateConsorcioDto } from './create-consorcio.dto';

export class UpdateConsorcioDto extends PartialType(CreateConsorcioDto) {}
