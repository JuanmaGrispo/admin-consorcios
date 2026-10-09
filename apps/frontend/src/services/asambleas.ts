import { api, descargar, query, subirArchivo } from '@/lib/api';
import type {
  Asamblea,
  AsambleaCambios,
  AsambleaDetalle,
  AsambleaInput,
  Asistencia,
  EstadoAsamblea,
  EstadoAsistencia,
  PuntoInput,
} from '@/types/asamblea';

/** Una función por endpoint de /asambleas. Los dos portales usan el mismo. */
export const asambleasService = {
  /** El administrador ve todas; el vecino, las convocadas de sus consorcios. */
  listar: (filtros: { consorcioId?: string; estado?: EstadoAsamblea; anio?: number } = {}) =>
    api<Asamblea[]>(`/asambleas${query(filtros)}`),

  obtener: (id: string) => api<AsambleaDetalle>(`/asambleas/${id}`),

  crear: (input: AsambleaInput) =>
    api<AsambleaDetalle>('/asambleas', { method: 'POST', body: JSON.stringify(input) }),

  actualizar: (id: string, cambios: AsambleaCambios) =>
    api<AsambleaDetalle>(`/asambleas/${id}`, { method: 'PATCH', body: JSON.stringify(cambios) }),

  eliminar: (id: string) => api<void>(`/asambleas/${id}`, { method: 'DELETE' }),

  /** Reemplaza el orden del día completo; sólo en borrador. */
  reemplazarOrdenDia: (id: string, puntos: PuntoInput[]) =>
    api<AsambleaDetalle>(`/asambleas/${id}/orden-dia`, {
      method: 'PUT',
      body: JSON.stringify({ puntos }),
    }),

  /** Arma el padrón de asistencia y avisa a los vecinos. */
  convocar: (id: string) => api<AsambleaDetalle>(`/asambleas/${id}/convocar`, { method: 'POST' }),

  iniciar: (id: string) => api<AsambleaDetalle>(`/asambleas/${id}/iniciar`, { method: 'POST' }),

  /** Queda CERRADA o CERRADA_SIN_QUORUM según el quórum alcanzado. */
  cerrar: (id: string) => api<AsambleaDetalle>(`/asambleas/${id}/cerrar`, { method: 'POST' }),

  /** Sube el acta firmada (PDF) y la deja cargada en la asamblea. */
  cargarActa: async (id: string, archivo: File) => {
    const { url } = await subirArchivo(archivo, 'actas');
    return api<AsambleaDetalle>(`/asambleas/${id}/acta`, {
      method: 'PATCH',
      body: JSON.stringify({ actaUrl: url }),
    });
  },

  /** Baja el borrador del acta en PDF para completarlo y firmarlo. */
  descargarActaBorrador: (id: string, nombre: string) =>
    descargar(`/asambleas/${id}/acta-borrador`, `acta-${nombre}.pdf`),

  /** El padrón completo de asistencia (sólo administrador). */
  listarAsistencias: (id: string) => api<Asistencia[]>(`/asambleas/${id}/asistencias`),

  /** El administrador registra una asistencia, incluidos los poderes. */
  registrarAsistencia: (
    id: string,
    unidadId: string,
    datos: { estado: EstadoAsistencia; apoderadoUnidadId?: string },
  ) =>
    api<Asistencia>(`/asambleas/${id}/asistencias/${unidadId}`, {
      method: 'PATCH',
      body: JSON.stringify(datos),
    }),

  /** El vecino responde “Asisto” o “No puedo”. */
  confirmarAsistencia: (
    id: string,
    datos: { estado: 'ASISTE' | 'NO_ASISTE'; unidadId?: string },
  ) =>
    api<Asistencia>(`/asambleas/${id}/asistencia`, {
      method: 'PUT',
      body: JSON.stringify(datos),
    }),
};
