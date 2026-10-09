import { api, query } from '@/lib/api';
import type { Paginado } from '@/types/comun';
import type {
  CrearReclamoInput,
  EstadoReclamo,
  FiltrosReclamos,
  Reclamo,
  ReclamoDetalle,
  ReclamoEvento,
  ResumenReclamos,
} from '@/types/reclamo';

/**
 * Una función por endpoint de /reclamos. Los dos portales usan las mismas:
 * el backend recorta lo que ve cada rol (al vecino, sólo sus unidades y sin
 * notas internas).
 */
export const reclamosService = {
  listar: (filtros: FiltrosReclamos = {}) =>
    api<Paginado<Reclamo>>(`/reclamos${query({ ...filtros })}`),

  resumen: (consorcioId?: string) =>
    api<ResumenReclamos>(`/reclamos/resumen${query({ consorcioId })}`),

  detalle: (id: string) => api<ReclamoDetalle>(`/reclamos/${id}`),

  crear: (input: CrearReclamoInput) =>
    api<Reclamo>('/reclamos', { method: 'POST', body: JSON.stringify(input) }),

  /** Respuesta al vecino o, con `interna`, nota que sólo ve la administración. */
  agregarMensaje: (id: string, mensaje: string, interna = false) =>
    api<ReclamoEvento>(`/reclamos/${id}/mensajes`, {
      method: 'POST',
      body: JSON.stringify({ mensaje, interna }),
    }),

  /** Si estaba en NUEVO, el backend lo pasa solo a EN_CURSO. */
  asignarProveedor: (id: string, proveedorId: string, mensaje?: string) =>
    api<Reclamo>(`/reclamos/${id}/proveedor`, {
      method: 'PATCH',
      body: JSON.stringify({ proveedorId, mensaje }),
    }),

  cambiarEstado: (id: string, estado: EstadoReclamo, mensaje?: string) =>
    api<Reclamo>(`/reclamos/${id}/estado`, {
      method: 'PATCH',
      body: JSON.stringify({ estado, mensaje }),
    }),
};
