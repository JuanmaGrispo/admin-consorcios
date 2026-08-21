import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule } from './clients/clients.module';
import { CoreModule } from './core/core.module';
import { DatabaseModule } from './database/database.module';
import { ConsorciosModule } from './modules/consorcios/consorcios.module';

/**
 * Capas del backend, de afuera hacia adentro:
 *
 *   controllers   HTTP: rutas, DTOs, validación de borde. No saben de negocio.
 *   services      Reglas de negocio. No saben de HTTP ni de SQL.
 *   repositories  Acceso a datos (TypeORM). No saben de negocio.
 *   clients       APIs externas. Traducen el mundo de afuera a tipos nuestros.
 *
 * Cada módulo de negocio vive en `modules/<nombre>/` con sus cuatro capas adentro.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    CoreModule,
    ClientsModule,

    // ── Módulos de negocio ──
    ConsorciosModule,
  ],
})
export class AppModule {}
