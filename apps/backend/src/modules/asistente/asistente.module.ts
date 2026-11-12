import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AsistenteFeedback,
  AsistenteInteraccion,
  Consorcio,
  ConfiguracionPlataforma,
  Unidad,
} from '../../database/entities';
import { ExpensasModule } from '../expensas/expensas.module';
import { ReclamosModule } from '../reclamos/reclamos.module';
import { ReservasModule } from '../reservas/reservas.module';
import { AI_GATEWAY } from './ai-gateway';
import { AsistenteController } from './asistente.controller';
import { AsistenteRepository } from './asistente.repository';
import { AsistenteService } from './asistente.service';
import { OpenAIClient } from './openai.client';
import { HerramientasAsistente } from './herramientas';
import { ManualClient } from './manual.client';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AsistenteInteraccion,
      AsistenteFeedback,
      ConfiguracionPlataforma,
      // Para nombrar unidades y consorcios en lo que devuelven las herramientas.
      Unidad,
      Consorcio,
    ]),
    // Las herramientas de lectura usan los mismos services que las pantallas.
    ExpensasModule,
    ReclamosModule,
    ReservasModule,
  ],
  controllers: [AsistenteController],
  providers: [
    AsistenteService,
    AsistenteRepository,
    HerramientasAsistente,
    ManualClient,
    // El service depende de la interfaz: cambiar de proveedor es cambiar esta línea.
    { provide: AI_GATEWAY, useClass: OpenAIClient },
  ],
})
export class AsistenteModule {}
