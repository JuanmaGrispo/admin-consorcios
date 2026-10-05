import { Module } from '@nestjs/common';
import { AsambleasModule } from '../asambleas/asambleas.module';
import { ExpensasModule } from '../expensas/expensas.module';
import { NovedadesModule } from '../novedades/novedades.module';
import { ReclamosModule } from '../reclamos/reclamos.module';
import { ReservasModule } from '../reservas/reservas.module';
import { UnidadesModule } from '../unidades/unidades.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { VotacionesModule } from '../votaciones/votaciones.module';
import { InicioController } from './inicio.controller';
import { InicioService } from './inicio.service';

/**
 * No tiene tablas propias ni repository: arma la pantalla de inicio del
 * vecino juntando lo que ya saben otros módulos.
 */
@Module({
  imports: [
    UsuariosModule,
    UnidadesModule,
    ExpensasModule,
    ReclamosModule,
    AsambleasModule,
    ReservasModule,
    VotacionesModule,
    NovedadesModule,
  ],
  controllers: [InicioController],
  providers: [InicioService],
})
export class InicioModule {}
