import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Reclamo,
  ReclamoAdjunto,
  ReclamoEvento,
  Unidad,
  UnidadUsuario,
} from '../../database/entities';
import { ReclamosController } from './reclamos.controller';
import { ReclamosRepository } from './reclamos.repository';
import { ReclamosService } from './reclamos.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Reclamo,
      ReclamoEvento,
      ReclamoAdjunto,
      // Para saber qué unidades ve cada vecino y de qué consorcio es la unidad.
      UnidadUsuario,
      Unidad,
    ]),
  ],
  controllers: [ReclamosController],
  providers: [ReclamosService, ReclamosRepository],
  exports: [ReclamosService],
})
export class ReclamosModule {}
