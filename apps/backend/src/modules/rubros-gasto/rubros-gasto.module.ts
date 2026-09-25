import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Gasto, RubroGasto } from '../../database/entities';
import { ConsorciosModule } from '../consorcios/consorcios.module';
import { RubrosGastoController } from './rubros-gasto.controller';
import { RubrosGastoRepository } from './rubros-gasto.repository';
import { RubrosGastoService } from './rubros-gasto.service';

@Module({
  imports: [
    // Gasto sólo para contar cuántos usan un rubro antes de borrarlo.
    TypeOrmModule.forFeature([RubroGasto, Gasto]),
    ConsorciosModule,
  ],
  controllers: [RubrosGastoController],
  providers: [RubrosGastoService, RubrosGastoRepository],
  exports: [RubrosGastoService],
})
export class RubrosGastoModule {}
