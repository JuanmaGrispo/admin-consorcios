import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Asamblea, Asistencia, PuntoOrdenDia, Unidad, UnidadUsuario } from '../../database/entities';
import { ArchivosModule } from '../archivos/archivos.module';
import { ConsorciosModule } from '../consorcios/consorcios.module';
import { AsambleasController } from './asambleas.controller';
import { AsambleasRepository } from './asambleas.repository';
import { AsambleasService } from './asambleas.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Asamblea,
      PuntoOrdenDia,
      Asistencia,
      // Para armar el padrón y saber qué unidades y consorcios ve cada vecino.
      Unidad,
      UnidadUsuario,
    ]),
    // Para validar que el consorcio exista al crear.
    ConsorciosModule,
    // Para confirmar que el acta es un PDF subido a `actas`.
    ArchivosModule,
  ],
  controllers: [AsambleasController],
  providers: [AsambleasService, AsambleasRepository],
  exports: [AsambleasService],
})
export class AsambleasModule {}
