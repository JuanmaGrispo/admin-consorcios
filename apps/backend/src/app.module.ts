import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CoreModule } from './core/core.module';
import { DatabaseModule } from './database/database.module';
import { ConsorciosModule } from './modules/consorcios/consorcios.module';

/**
 * Cada módulo de negocio vive en `modules/<nombre>/` y se compone de:
 *
 *   <nombre>.module.ts       cableado del módulo
 *   <nombre>.controller.ts   HTTP: rutas, DTOs, validación de borde
 *   <nombre>.service.ts      reglas de negocio
 *   <nombre>.repository.ts   acceso a datos (TypeORM) — si tiene db
 *   <nombre>.entities.ts     entidades del módulo
 *   <nombre>.client.ts       API externa — si consume una
 *
 * `consorcios/` es el ejemplo de referencia. Lo transversal (health, auth
 * futura) va en `core/`.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    CoreModule,

    // ── Módulos de negocio ──
    ConsorciosModule,
  ],
})
export class AppModule {}
