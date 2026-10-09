import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PreferenciaNotificacion, Usuario } from '../../database/entities';
import { ArchivosModule } from '../archivos/archivos.module';
import { PerfilController } from './perfil.controller';
import { UsuariosController } from './usuarios.controller';
import { UsuariosRepository } from './usuarios.repository';
import { UsuariosService } from './usuarios.service';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario, PreferenciaNotificacion]), ArchivosModule],
  controllers: [UsuariosController, PerfilController],
  providers: [UsuariosService, UsuariosRepository],
  exports: [UsuariosService],
})
export class UsuariosModule {}
