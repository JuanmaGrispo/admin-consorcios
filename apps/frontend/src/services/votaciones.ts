import { api, query, subirArchivo } from '@/lib/api';
import type {
  EstadoVotacion,
  FilaPadron,
  FormaConteo,
  PadronVotacion,
  VistaPadron,
  Votacion,
  VotacionCambios,
  VotacionDetalle,
  VotacionInput,
  VotoEmitido,
} from '@/types/votacion';

/** Una función por endpoint de /votaciones. Los dos portales usan el mismo. */
export const votacionesService = {
  /** El administrador ve todas; el vecino, las publicadas de sus consorcios. */
  listar: (filtros: { consorcioId?: string; asambleaId?: string; estado?: EstadoVotacion } = {}) =>
    api<Votacion[]>(`/votaciones${query(filtros)}`),

  obtener: (id: string) => api<VotacionDetalle>(`/votaciones/${id}`),

  /** Antes de crear: cuántas unidades votarían con ese padrón y forma de conteo. */
  vistaPadron: (filtros: { consorcioId: string; padron?: PadronVotacion; formaConteo?: FormaConteo }) =>
    api<VistaPadron>(`/votaciones/padron${query(filtros)}`),

  crear: (input: VotacionInput) =>
    api<VotacionDetalle>('/votaciones', { method: 'POST', body: JSON.stringify(input) }),

  actualizar: (id: string, cambios: VotacionCambios) =>
    api<VotacionDetalle>(`/votaciones/${id}`, { method: 'PATCH', body: JSON.stringify(cambios) }),

  eliminar: (id: string) => api<void>(`/votaciones/${id}`, { method: 'DELETE' }),

  /** Reemplaza las opciones no fijas; sólo en borrador. */
  reemplazarOpciones: (id: string, opciones: string[]) =>
    api<VotacionDetalle>(`/votaciones/${id}/opciones`, {
      method: 'PUT',
      body: JSON.stringify({ opciones }),
    }),

  /** Abre la votación y avisa a los vecinos. */
  publicar: (id: string) => api<VotacionDetalle>(`/votaciones/${id}/publicar`, { method: 'POST' }),

  /** Cierra y guarda el resultado. */
  cerrar: (id: string) => api<VotacionDetalle>(`/votaciones/${id}/cerrar`, { method: 'POST' }),

  /** El padrón con quién votó y por qué canal (sólo administrador). */
  padronConVotos: (id: string) => api<FilaPadron[]>(`/votaciones/${id}/votos`),

  /** El administrador carga el voto presencial de una unidad. */
  votarPresencial: (id: string, unidadId: string, opcionId: string) =>
    api<VotoEmitido>(`/votaciones/${id}/votos/${unidadId}`, {
      method: 'POST',
      body: JSON.stringify({ opcionId }),
    }),

  /** El vecino vota; con varias unidades habilitadas hay que decir cuál. */
  votar: (id: string, opcionId: string, unidadId?: string) =>
    api<VotoEmitido>(`/votaciones/${id}/votos`, {
      method: 'POST',
      body: JSON.stringify({ opcionId, unidadId }),
    }),

  /** Sube el adjunto (PDF o imagen) de una votación; su `url` va después en `crear`. */
  subirAdjunto: (archivo: File) => subirArchivo(archivo, 'votaciones'),
};
