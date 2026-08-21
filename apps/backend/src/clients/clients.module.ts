import { Module } from '@nestjs/common';

/**
 * Clientes de APIs externas. Cuando aparezca el primero (pagos, geolocalización,
 * mail, lo que sea), se declara acá como provider y se exporta para que los
 * services de negocio lo inyecten. Ver http-client.base.ts para el patrón.
 */
@Module({
  providers: [],
  exports: [],
})
export class ClientsModule {}
