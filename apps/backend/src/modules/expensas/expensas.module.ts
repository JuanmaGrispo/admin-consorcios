import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Boleta,
  BoletaDetalle,
  Gasto,
  Liquidacion,
  Unidad,
  UnidadUsuario,
} from '../../database/entities';
import { ConsorciosModule } from '../consorcios/consorcios.module';
import { ProveedoresModule } from '../proveedores/proveedores.module';
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
    ]),
    ConsorciosModule,
    RubrosGastoModule,
    ProveedoresModule,
  ],
  controllers: [ExpensasController],
  providers: [ExpensasService, ExpensasRepository],
  exports: [ExpensasService],
})
export class ExpensasModule {}
