import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notificacion } from '../../database/entities';
import { BandejaNotificaciones } from './bandeja.consumer';
import { BandejaController } from './bandeja.controller';
import { BandejaRepository } from './bandeja.repository';
import { BandejaService } from './bandeja.service';

/**
 * El centro de notificaciones in-app (tabla `notificacion`). No es
 * `core/notificaciones`: aquello es el `Notificador` que publica avisos; esto
 * los guarda para que el usuario los vea en la app.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Notificacion])],
  controllers: [BandejaController],
  providers: [BandejaService, BandejaRepository, BandejaNotificaciones],
})
export class BandejaModule {}
