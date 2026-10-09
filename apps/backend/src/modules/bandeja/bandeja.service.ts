import { Injectable, NotFoundException } from '@nestjs/common';
import type { EventoDomus } from '../../core/mensajeria/eventos';
import { avisoDeBandeja } from './bandeja';
import { BandejaRepository } from './bandeja.repository';
import { ListarNotificacionesQuery } from './dto/listar-notificaciones.query';

/**
 * El centro de notificaciones de cada usuario: la campana del inicio y la
 * lista del perfil. Se llena escuchando los mismos eventos que el mail, así
 * que lo que llega por correo también queda acá, aunque el mail no se lea.
 */
@Injectable()
export class BandejaService {
  constructor(private readonly bandeja: BandejaRepository) {}

  async procesar(evento: EventoDomus): Promise<void> {
    await this.bandeja.guardar(evento.evento_id, await this.destinatarios(evento), avisoDeBandeja(evento));
  }

  async listar(usuarioId: string, query: ListarNotificacionesQuery) {
    const pagina = query.pagina ?? 1;
    const limite = query.limite ?? 20;
    const [[items, total], noLeidas] = await Promise.all([
      this.bandeja.listar(usuarioId, { soloNoLeidas: query.soloNoLeidas ?? false, pagina, limite }),
      this.bandeja.contarNoLeidas(usuarioId),
    ]);
    return { items, total, noLeidas, pagina, paginas: Math.ceil(total / limite) || 1 };
  }

  async marcarLeida(usuarioId: string, id: string): Promise<void> {
    if (!(await this.bandeja.marcarLeida(usuarioId, id))) {
      throw new NotFoundException(`La notificación ${id} no existe`);
    }
  }

  marcarTodas(usuarioId: string): Promise<void> {
    return this.bandeja.marcarTodas(usuarioId);
  }

  private async destinatarios(evento: EventoDomus): Promise<string[]> {
    switch (evento.tipo_evento) {
      case 'expensas.emitidas':
        return this.bandeja.vecinosDeUnidades(evento.payload.unidades_afectadas);
      case 'reclamo.cerrado':
        return this.unaPersona(evento.payload.usuario_id);
      case 'aviso.directo':
        return this.unaPersona(evento.payload.destinatario_id);
      default:
        return evento.consorcio_id ? this.bandeja.vecinosDelConsorcio(evento.consorcio_id) : [];
    }
  }

  private async unaPersona(usuarioId: string): Promise<string[]> {
    return (await this.bandeja.estaActivo(usuarioId)) ? [usuarioId] : [];
  }
}
