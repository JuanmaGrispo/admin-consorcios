import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriaReclamo, Reclamo } from '../../database/entities';
import { ConsorciosModule } from '../consorcios/consorcios.module';
import { CategoriasReclamoController } from './categorias-reclamo.controller';
import { CategoriasReclamoRepository } from './categorias-reclamo.repository';
import { CategoriasReclamoService } from './categorias-reclamo.service';

@Module({
  imports: [
    // Reclamo sólo para contar cuántos usan una categoría antes de borrarla.
    TypeOrmModule.forFeature([CategoriaReclamo, Reclamo]),
    ConsorciosModule,
  ],
  controllers: [CategoriasReclamoController],
  providers: [CategoriasReclamoService, CategoriasReclamoRepository],
  exports: [CategoriasReclamoService],
})
export class CategoriasReclamoModule {}
