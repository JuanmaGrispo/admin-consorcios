import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Amenity,
  AmenityBloqueo,
  Reserva,
  Unidad,
  UnidadUsuario,
} from '../../database/entities';
import { ConsorciosModule } from '../consorcios/consorcios.module';
import { ExpensasModule } from '../expensas/expensas.module';
import { ReservasController } from './reservas.controller';
import { ReservasRepository } from './reservas.repository';
import { ReservasService } from './reservas.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Amenity,
      AmenityBloqueo,
      Reserva,
      // Sobre qué unidad se reserva y quién vive ahí.
      Unidad,
      UnidadUsuario,
    ]),
    ConsorciosModule,
    // Para los amenities con `bloquea_con_deuda`.
    ExpensasModule,
  ],
  controllers: [ReservasController],
  providers: [ReservasService, ReservasRepository],
  exports: [ReservasService],
})
export class ReservasModule {}
