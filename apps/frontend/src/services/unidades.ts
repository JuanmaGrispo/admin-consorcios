import { api, query } from '@/lib/api';
import type { Unidad, UnidadCambios, UnidadInput, Vinculo, VinculoInput } from '@/types/unidad';

/** Una función por endpoint de /unidades. Los dos portales usan el mismo. */
export const unidadesService = {
  /** El administrador ve las de sus consorcios; el vecino, las suyas. */
  listar: (filtros: { consorcioId?: string; incluirInactivas?: boolean } = {}) =>
    api<Unidad[]>(`/unidades${query(filtros)}`),

  obtener: (id: string) => api<Unidad>(`/unidades/${id}`),

  /** La etiqueta es única en el consorcio y los coeficientes activos no pueden pasar el 100%. */
  crear: (input: UnidadInput) =>
    api<Unidad>('/unidades', { method: 'POST', body: JSON.stringify(input) }),

  /** Con `activa: false` se da de baja: las unidades no se borran. */
  actualizar: (id: string, cambios: UnidadCambios) =>
    api<Unidad>(`/unidades/${id}`, { method: 'PATCH', body: JSON.stringify(cambios) }),

  listarVinculos: (id: string, incluirTerminados = false) =>
    api<Vinculo[]>(`/unidades/${id}/vinculos${query({ incluirTerminados: incluirTerminados || undefined })}`),

  /** Vincula un vecino que ya tiene cuenta, o lo da de alta en el mismo paso. */
  vincular: (id: string, input: VinculoInput) =>
    api<Vinculo>(`/unidades/${id}/vinculos`, { method: 'POST', body: JSON.stringify(input) }),

  /** Termina el vínculo hoy; si todavía no había empezado, se borra. */
  desvincular: (id: string, vinculoId: string) =>
    api<void>(`/unidades/${id}/vinculos/${vinculoId}`, { method: 'DELETE' }),
};
