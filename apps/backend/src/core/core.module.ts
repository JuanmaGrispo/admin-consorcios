import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';

/**
 * Lo transversal que no es negocio: health, y a futuro auth, logging, filtros
 * de excepciones. Los módulos de negocio viven en `modules/`.
 */
@Module({
  controllers: [HealthController],
})
export class CoreModule {}
