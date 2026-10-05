import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Novedad, NovedadAdjunto, NovedadLectura } from '../../database/entities';
import { ArchivosModule } from '../archivos/archivos.module';
import { MuroNovedadesPublicador } from './muro.consumer';
import { NovedadesController } from './novedades.controller';
import { NovedadesRepository } from './novedades.repository';
import { NovedadesService } from './novedades.service';

@Module({
  imports: [TypeOrmModule.forFeature([Novedad, NovedadAdjunto, NovedadLectura]), ArchivosModule],
  controllers: [NovedadesController],
  providers: [NovedadesService, NovedadesRepository, MuroNovedadesPublicador],
  exports: [NovedadesService],
})
export class NovedadesModule {}
