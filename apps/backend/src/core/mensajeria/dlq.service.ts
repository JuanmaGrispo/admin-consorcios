import { validarSobre } from './eventos';
import { DlqClient } from './dlq.client';

export class DlqService {
  constructor(private readonly client: DlqClient) {}
  async ejecutar(url: string, cola: string, eventoId?: string, limite = 100): Promise<unknown> {
    if (!Number.isInteger(limite) || limite < 1 || limite > 1000) throw new Error('El límite debe estar entre 1 y 1000');
    try {
      await this.client.abrir(url, cola);
      const mensajes = await this.client.leer(cola, limite);
      const filas = mensajes.map((m) => {
        try { return { mensaje: m, evento: validarSobre(JSON.parse(m.content.toString())) }; }
        catch { return { mensaje: m, evento: null }; }
      });
      if (!eventoId) return filas.map(({ mensaje, evento }) => ({ eventoId: evento?.evento_id ?? mensaje.properties.messageId ?? null,
        tipo: evento?.tipo_evento ?? 'inválido', intentos: mensaje.properties.headers?.['x-intentos'] ?? 0 }));
      const encontrada = filas.find((f) => f.evento?.evento_id === eventoId);
      if (!encontrada) throw new Error('Evento válido no encontrado dentro del límite. No se modificó ningún mensaje.');
      await this.client.republicar(cola, encontrada.mensaje);
      return { eventoId, cola, reprocesado: true, timestamp: new Date().toISOString() };
    } finally { await this.client.cerrar(); }
  }
}
