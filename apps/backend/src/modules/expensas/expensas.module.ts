import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Boleta,
  BoletaDetalle,
  Gasto,
  Liquidacion,
  Unidad,
  UnidadUsuario,
  Votacion,
} from '../../database/entities';
import { ArchivosModule } from '../archivos/archivos.module';
import { ConsorciosModule } from '../consorcios/consorcios.module';
import { ProveedoresModule } from '../proveedores/proveedores.module';
import { ReclamosModule } from '../reclamos/reclamos.module';
import { RubrosGastoModule } from '../rubros-gasto/rubros-gasto.module';
import { ExpensasController } from './expensas.controller';
import { ExpensasRepository } from './expensas.repository';
import { ExpensasService } from './expensas.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Liquidacion,
      Gasto,
      Boleta,
      BoletaDetalle,
      // Entre quiénes se reparte y a quién se le avisa.
      Unidad,
      UnidadUsuario,
      // Para validar la votación de un gasto, hasta que exista su módulo.
      Votacion,
    ]),
    ConsorciosModule,
    // Para confirmar que el comprobante se subió a `comprobantes`.
    ArchivosModule,
    RubrosGastoModule,
    ProveedoresModule,
    ReclamosModule,
  ],
  controllers: [ExpensasController],
  providers: [ExpensasService, ExpensasRepository],
  exports: [ExpensasService],
})
export class ExpensasModule {}
