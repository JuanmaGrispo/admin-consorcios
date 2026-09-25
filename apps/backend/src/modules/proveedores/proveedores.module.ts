import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Proveedor } from '../../database/entities';
import { ConsorciosModule } from '../consorcios/consorcios.module';
import { ProveedoresController } from './proveedores.controller';
import { ProveedoresRepository } from './proveedores.repository';
import { ProveedoresService } from './proveedores.service';

@Module({
  imports: [TypeOrmModule.forFeature([Proveedor]), ConsorciosModule],
  controllers: [ProveedoresController],
  providers: [ProveedoresService, ProveedoresRepository],
  exports: [ProveedoresService],
})
export class ProveedoresModule {}
