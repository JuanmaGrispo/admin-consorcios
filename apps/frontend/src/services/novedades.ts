import { api, query, subirArchivo } from '@/lib/api';
import type { Paginado } from '@/types/comun';
import type { Novedad, NovedadCambios, NovedadInput } from '@/types/novedad';

/** Una función por endpoint de /novedades. Los dos portales usan el mismo. */
export const novedadesService = {
  /** Fijadas primero. `incluirInactivas` sólo vale para el administrador. */
  listar: (
    filtros: { consorcioId?: string; incluirInactivas?: boolean; pagina?: number; limite?: number } = {},
  ) => api<Paginado<Novedad>>(`/novedades${query(filtros)}`),

  obtener: (id: string) => api<Novedad>(`/novedades/${id}`),

  crear: (input: NovedadInput) =>
    api<Novedad>('/novedades', { method: 'POST', body: JSON.stringify(input) }),

  actualizar: (id: string, cambios: NovedadCambios) =>
    api<Novedad>(`/novedades/${id}`, { method: 'PATCH', body: JSON.stringify(cambios) }),

  marcarLeida: (id: string) => api<void>(`/novedades/${id}/lectura`, { method: 'PUT' }),

  /** Sube un adjunto (imagen o PDF, hasta 10 MB). Su `url` va después en `crear`. */
  subirAdjunto: (archivo: File) => subirArchivo(archivo, 'novedades'),
};
