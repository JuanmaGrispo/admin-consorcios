import { api, ApiError, eventos, query } from '@/lib/api';
import type { MetricasAsistente, PreguntaAsistente, RespuestaAsistente } from '@/types/asistente';

/** Una función por endpoint de /asistente. */
export const asistenteService = {
  /** Si está prendido: sin esto no se muestra el botón de ayuda. */
  estado: () => api<{ habilitado: boolean }>('/asistente/estado'),

  preguntar: (pregunta: PreguntaAsistente) =>
    api<RespuestaAsistente>('/asistente/preguntas', { method: 'POST', body: JSON.stringify(pregunta) }),

  /**
   * La misma pregunta, con la respuesta a medida que se escribe: `onTexto`
   * recibe cada pedazo nuevo. Lo que devuelve al final es la respuesta
   * completa y validada, que reemplaza al texto parcial.
   */
  preguntarEnVivo: async (pregunta: PreguntaAsistente, onTexto: (pedazo: string) => void) => {
    let final: RespuestaAsistente | undefined;
    await eventos('/asistente/preguntas/stream', pregunta, (evento, datos) => {
      if (evento === 'texto') onTexto((datos as { texto: string }).texto);
      else if (evento === 'fin') final = datos as RespuestaAsistente;
      else if (evento === 'error') {
        const { status, message } = datos as { status: number; message: string };
        throw new ApiError(status, message);
      }
    });
    if (!final) throw new ApiError(500, 'La respuesta se cortó. Probá de nuevo.');
    return final;
  },

  feedback: (interaccionId: string, util: boolean) =>
    api<void>('/asistente/feedback', {
      method: 'POST',
      body: JSON.stringify({ interaccion_id: interaccionId, util }),
    }),

  // ── Superadministrador ──

  cambiarHabilitado: (habilitado: boolean) =>
    api<{ habilitado: boolean }>('/asistente/habilitado', { method: 'PUT', body: JSON.stringify({ habilitado }) }),

  metricas: (dias = 7) => api<MetricasAsistente>(`/asistente/metricas${query({ dias })}`),
};
