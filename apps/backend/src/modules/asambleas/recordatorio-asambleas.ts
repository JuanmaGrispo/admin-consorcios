import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AsambleasService } from './asambleas.service';

/**
 * El único cron del proyecto. El resto de los estados que resuelve el tiempo
 * (boletas vencidas, reservas finalizadas, votaciones cerradas) se actualiza
 * antes de cada lectura; acá no hay lectura que dispare nada: el recordatorio
 * tiene que salir aunque nadie abra la app.
 */
@Injectable()
export class RecordatorioAsambleas {
  private readonly logger = new Logger(RecordatorioAsambleas.name);

  constructor(private readonly asambleas: AsambleasService) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async recordar(): Promise<void> {
    try {
      const enviados = await this.asambleas.enviarRecordatorios();
      if (enviados > 0) this.logger.log(`Recordatorio de ${enviados} asamblea(s)`);
    } catch (error) {
      this.logger.error(`No se pudieron revisar los recordatorios: ${String(error)}`);
    }
  }
}
