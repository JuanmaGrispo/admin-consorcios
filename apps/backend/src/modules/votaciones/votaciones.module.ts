import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Asistencia,
  OpcionVoto,
  PuntoOrdenDia,
  Unidad,
  UnidadUsuario,
  Votacion,
  Voto,
} from '../../database/entities';
import { ArchivosModule } from '../archivos/archivos.module';
import { ConsorciosModule } from '../consorcios/consorcios.module';
import { ExpensasModule } from '../expensas/expensas.module';
import { VotacionesController } from './votaciones.controller';
import { VotacionesRepository } from './votaciones.repository';
import { VotacionesService } from './votaciones.service';

/**
 * No importa AsambleasModule: lee el punto del orden del día y la asistencia
 * por su cuenta. Es asambleas el que pregunta por votaciones (no se cierra
 * con votaciones abiertas), y al revés sería un ciclo.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Votacion,
      OpcionVoto,
      Voto,
      PuntoOrdenDia,
      Asistencia,
      // Para armar el padrón y saber qué consorcios ve cada vecino.
      Unidad,
      UnidadUsuario,
    ]),
    ConsorciosModule,
    // Para `bloquea_con_deuda`.
    ExpensasModule,
    // Para el presupuesto adjunto.
    ArchivosModule,
  ],
  controllers: [VotacionesController],
  providers: [VotacionesService, VotacionesRepository],
  exports: [VotacionesService],
})
export class VotacionesModule {}
