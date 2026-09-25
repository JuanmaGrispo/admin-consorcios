import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Unidad, UnidadUsuario } from '../../database/entities';
import { ConsorciosModule } from '../consorcios/consorcios.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { UnidadesController } from './unidades.controller';
import { UnidadesRepository } from './unidades.repository';
import { UnidadesService } from './unidades.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Unidad, UnidadUsuario]),
    ConsorciosModule,
    UsuariosModule,
  ],
  controllers: [UnidadesController],
  providers: [UnidadesService, UnidadesRepository],
  exports: [UnidadesService],
})
export class UnidadesModule {}
