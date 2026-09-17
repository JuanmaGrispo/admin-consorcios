import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../modules/auth/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  // Abierto a propósito: un chequeo de vida que pide token no sirve para
  // monitorear.
  @Public()
  @Get()
  check() {
    return { status: 'ok' };
  }
}
