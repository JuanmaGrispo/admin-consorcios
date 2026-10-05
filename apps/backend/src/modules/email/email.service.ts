import { Injectable, Logger } from '@nestjs/common';
import type { EventoDomus } from '../../core/mensajeria/eventos';
import { CanalNotificacion, EstadoEnvio } from '../../database/entities';
import { type Destinatario, EmailRepository, type VecinoDeUnidad } from './email.repository';
import { MailerClient } from './mailer.client';
import { type Contexto, redactar } from './plantillas';

interface Entrega {
  destinatario: Destinatario;
  contexto: Contexto;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly email: EmailRepository,
    private readonly mailer: MailerClient,
  ) {}

  /**
   * Un mail por persona. Si alguno falla, lanza para que el evento vuelva por
   * la cola de reintento; los que ya salieron quedan ENVIADO y no se repiten.
   */
  async procesar(evento: EventoDomus): Promise<void> {
    const entregas = await this.entregasDe(evento);

    if (!this.mailer.configurado) {
      for (const { destinatario, contexto } of entregas) {
        this.logger.log(`[mail sin SMTP] ${destinatario.email}: ${redactar(evento, contexto).asunto}`);
      }
      return;
    }

    let fallidos = 0;
    for (const entrega of entregas) {
      if (!(await this.entregar(evento, entrega))) fallidos++;
    }
    if (fallidos > 0) {
      throw new Error(`${fallidos} de ${entregas.length} mails de ${evento.tipo_evento} fallaron`);
    }
  }

  private async entregar(evento: EventoDomus, { destinatario, contexto }: Entrega): Promise<boolean> {
    const previo = await this.email.buscarEnvio(evento.evento_id, destinatario.email);
    if (previo?.estado === EstadoEnvio.ENVIADO) return true;

    const envio =
      previo ??
      (await this.email.crearEnvio({
        canal: CanalNotificacion.EMAIL,
        destinatario: destinatario.email,
        plantilla: evento.tipo_evento,
        payload: evento.payload as unknown as Record<string, unknown>,
        estado: EstadoEnvio.PENDIENTE,
        intentos: 0,
        entidadTipo: 'evento',
        entidadId: evento.evento_id,
      }));

    const mensaje = redactar(evento, contexto);
    try {
      await this.mailer.enviar({ para: destinatario.email, ...mensaje });
      await this.email.actualizarEnvio(envio.id, {
        estado: EstadoEnvio.ENVIADO,
        intentos: envio.intentos + 1,
        enviadoAt: new Date(),
        ultimoError: null,
      });
      return true;
    } catch (error) {
      await this.email.actualizarEnvio(envio.id, {
        estado: EstadoEnvio.FALLIDO,
        intentos: envio.intentos + 1,
        ultimoError: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  private async entregasDe(evento: EventoDomus): Promise<Entrega[]> {
    switch (evento.tipo_evento) {
      case 'expensas.emitidas': {
        const [vecinos, totales] = await Promise.all([
          this.email.vecinosDeUnidades(evento.payload.unidades_afectadas),
          this.email.totalesDeLiquidacion(evento.payload.liquidacion_id),
        ]);
        // Un mail por persona, con todas sus unidades: el dueño de dos
        // departamentos no recibe dos mails iguales.
        return agruparPorEmail(vecinos).map(([destinatario, unidades]) => ({
          destinatario,
          contexto: {
            nombre: destinatario.nombre,
            unidades: unidades.map((u) => ({ etiqueta: u.etiqueta, total: totales.get(u.unidadId) ?? 0 })),
          },
        }));
      }
      case 'reclamo.cerrado':
        return this.aUnaPersona(evento.payload.usuario_id);
      case 'aviso.directo':
        return this.aUnaPersona(evento.payload.destinatario_id);
      default: {
        const vecinos = await this.email.vecinosDelConsorcio(evento.consorcio_id!);
        return agruparPorEmail(vecinos).map(([destinatario]) => ({
          destinatario,
          contexto: { nombre: destinatario.nombre },
        }));
      }
    }
  }

  private async aUnaPersona(usuarioId: string): Promise<Entrega[]> {
    const destinatario = await this.email.usuario(usuarioId);
    return destinatario ? [{ destinatario, contexto: { nombre: destinatario.nombre } }] : [];
  }
}

function agruparPorEmail(vecinos: VecinoDeUnidad[]): [Destinatario, VecinoDeUnidad[]][] {
  const grupos = new Map<string, [Destinatario, VecinoDeUnidad[]]>();
  for (const vecino of vecinos) {
    const grupo = grupos.get(vecino.email);
    if (grupo) grupo[1].push(vecino);
    else grupos.set(vecino.email, [vecino, [vecino]]);
  }
  return [...grupos.values()];
}
