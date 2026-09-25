import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Reclamo,
  ReclamoAdjunto,
  ReclamoEvento,
  Unidad,
  UnidadUsuario,
} from '../../database/entities';
import { CategoriasReclamoModule } from '../categorias-reclamo/categorias-reclamo.module';
import { ProveedoresModule } from '../proveedores/proveedores.module';
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
    // Para validar que la categoría y el proveedor correspondan al consorcio.
    CategoriasReclamoModule,
    ProveedoresModule,
  ],
  controllers: [ReclamosController],
  providers: [ReclamosService, ReclamosRepository],
  exports: [ReclamosService],
})
export class ReclamosModule {}
