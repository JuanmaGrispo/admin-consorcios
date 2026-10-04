import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Novedad, NovedadAdjunto, NovedadLectura } from '../../database/entities';
import { ArchivosModule } from '../archivos/archivos.module';
import { NovedadesController } from './novedades.controller';
import { NovedadesRepository } from './novedades.repository';
import { NovedadesService } from './novedades.service';

@Module({
  imports: [TypeOrmModule.forFeature([Novedad, NovedadAdjunto, NovedadLectura]), ArchivosModule],
  controllers: [NovedadesController],
  providers: [NovedadesService, NovedadesRepository],
  exports: [NovedadesService],
})
export class NovedadesModule {}
