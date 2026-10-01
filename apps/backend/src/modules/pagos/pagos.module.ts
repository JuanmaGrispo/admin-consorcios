import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pago } from '../../database/entities';
import { ExpensasModule } from '../expensas/expensas.module';
import { MercadoPagoClient } from './mercado-pago.client';
import { PagosController } from './pagos.controller';
import { PagosRepository } from './pagos.repository';
import { PagosService } from './pagos.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Pago]),
    // La boleta es de expensas: a quién se le cobra y cómo queda su estado.
    ExpensasModule,
  ],
  controllers: [PagosController],
  providers: [PagosService, PagosRepository, MercadoPagoClient],
})
export class PagosModule {}
