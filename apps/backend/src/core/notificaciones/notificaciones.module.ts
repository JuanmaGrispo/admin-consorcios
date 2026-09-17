import { Global, Module } from '@nestjs/common';
import { Notificador } from './notificador';

/**
 * Global: avisar es transversal y lo van a usar casi todos los módulos.
 * Declararlo una vez evita que cada uno lo importe.
 */
@Global()
@Module({
  providers: [Notificador],
  exports: [Notificador],
})
export class NotificacionesModule {}
