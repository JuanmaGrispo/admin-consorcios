import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { CoreModule } from './core/core.module';
import { MensajeriaModule } from './core/mensajeria/mensajeria.module';
import { NotificacionesModule } from './core/notificaciones/notificaciones.module';
import { DatabaseModule } from './database/database.module';
import { ArchivosModule } from './modules/archivos/archivos.module';
import { AsambleasModule } from './modules/asambleas/asambleas.module';
import { AuthModule } from './modules/auth/auth.module';
import { CategoriasReclamoModule } from './modules/categorias-reclamo/categorias-reclamo.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { ConsorciosModule } from './modules/consorcios/consorcios.module';
import { EmailModule } from './modules/email/email.module';
import { ExpensasModule } from './modules/expensas/expensas.module';
import { BandejaModule } from './modules/bandeja/bandeja.module';
import { InicioModule } from './modules/inicio/inicio.module';
import { PanelModule } from './modules/panel/panel.module';
import { NovedadesModule } from './modules/novedades/novedades.module';
import { PagosModule } from './modules/pagos/pagos.module';
import { ProveedoresModule } from './modules/proveedores/proveedores.module';
import { ReclamosModule } from './modules/reclamos/reclamos.module';
import { ReservasModule } from './modules/reservas/reservas.module';
import { RubrosGastoModule } from './modules/rubros-gasto/rubros-gasto.module';
import { UnidadesModule } from './modules/unidades/unidades.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { VotacionesModule } from './modules/votaciones/votaciones.module';

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
    ScheduleModule.forRoot(),
    DatabaseModule,
    CoreModule,
    MensajeriaModule,
    NotificacionesModule,

    // ── Módulos de negocio ──
    AuthModule,
    UsuariosModule,
    // La puerta única para subir archivos: las URLs que devuelve las guardan
    // los módulos que las usan.
    ArchivosModule,
    ConsorciosModule,
    UnidadesModule,
    ProveedoresModule,
    CategoriasReclamoModule,
    ReclamosModule,
    RubrosGastoModule,
    ExpensasModule,
    PagosModule,
    ReservasModule,
    AsambleasModule,
    VotacionesModule,
    NovedadesModule,
    // Consumidor de la cola de mails: no expone rutas.
    EmailModule,
    // El centro de notificaciones in-app: consume los mismos eventos que el mail.
    BandejaModule,
    // Compone la pantalla de inicio del vecino: va último porque depende de
    // todos los anteriores.
    InicioModule,
    // Lo mismo para el panel general del administrador.
    PanelModule,
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
