import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { CoreModule } from './core/core.module';
import { NotificacionesModule } from './core/notificaciones/notificaciones.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { ConsorciosModule } from './modules/consorcios/consorcios.module';
import { ReclamosModule } from './modules/reclamos/reclamos.module';

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
 * `consorcios/` es el ejemplo de referencia. Lo transversal (health, auth)
 * va en `core/` y `modules/auth/`.
 *
 * Las entidades son la excepción: no viven en cada módulo, se generan desde la
 * base en `database/entities/`. La base es la fuente de verdad del esquema.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    CoreModule,
    NotificacionesModule,

    // ── Módulos de negocio ──
    AuthModule,
    ConsorciosModule,
    ReclamosModule,
  ],
  providers: [
    // Guards globales: todo pide token salvo lo marcado con @Public(), y el de
    // roles corre después para chequear @Roles(). El orden importa — Nest los
    // ejecuta en el orden en que están declarados.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
