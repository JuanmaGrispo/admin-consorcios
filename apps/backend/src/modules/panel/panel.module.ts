import { Module } from '@nestjs/common';
import { AsambleasModule } from '../asambleas/asambleas.module';
import { ConsorciosModule } from '../consorcios/consorcios.module';
import { ExpensasModule } from '../expensas/expensas.module';
import { ReclamosModule } from '../reclamos/reclamos.module';
import { ReservasModule } from '../reservas/reservas.module';
import { VotacionesModule } from '../votaciones/votaciones.module';
import { PanelController } from './panel.controller';
import { PanelService } from './panel.service';

/**
 * No tiene tablas propias ni repository: arma el panel general del
 * administrador juntando lo que ya saben otros módulos.
 */
@Module({
  imports: [
    ConsorciosModule,
    ExpensasModule,
    ReclamosModule,
    ReservasModule,
    VotacionesModule,
    AsambleasModule,
  ],
  controllers: [PanelController],
  providers: [PanelService],
})
export class PanelModule {}
