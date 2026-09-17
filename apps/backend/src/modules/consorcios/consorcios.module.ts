import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConsorciosController } from './consorcios.controller';
import { ConsorciosRepository } from './consorcios.repository';
import { ConsorciosService } from './consorcios.service';
import { Consorcio } from '../../database/entities';
import { UsuariosModule } from '../usuarios/usuarios.module';

@Module({
  imports: [TypeOrmModule.forFeature([Consorcio]), UsuariosModule],
  controllers: [ConsorciosController],
  providers: [ConsorciosService, ConsorciosRepository],
  exports: [ConsorciosService],
})
export class ConsorciosModule {}
