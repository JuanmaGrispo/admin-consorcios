import { Module } from '@nestjs/common';
import { ArchivosClient } from './archivos.client';
import { ArchivosController } from './archivos.controller';
import { ArchivosService } from './archivos.service';

/**
 * Sin repository: los archivos viven en Supabase Storage, no en la base. Lo
 * que se guarda en Postgres es la URL, y la guarda el módulo que la usa
 * (reclamos, expensas, etc.), no este.
 */
@Module({
  controllers: [ArchivosController],
  providers: [ArchivosService, ArchivosClient],
  exports: [ArchivosService],
})
export class ArchivosModule {}
