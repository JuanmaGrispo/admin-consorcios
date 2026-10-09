import { api, query } from '@/lib/api';
import type { Paginado } from '@/types/comun';
import type {
  Amenity,
  AmenityCambios,
  AmenityInput,
  Bloqueo,
  BloqueoInput,
  CalendarioAmenity,
  Disponibilidad,
  EstadoReserva,
  Reserva,
  ReservaInput,
} from '@/types/reserva';

const json = (method: string, cuerpo?: unknown): RequestInit => ({
  method,
  body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
});

/** Una función por endpoint de /amenities y /reservas. Los dos portales usan el mismo. */
export const reservasService = {
  // ── Amenities ──
  listarAmenities: (filtros: { consorcioId?: string; incluirInactivos?: boolean } = {}) =>
    api<Amenity[]>(`/amenities${query(filtros)}`),

  crearAmenity: (input: AmenityInput) => api<Amenity>('/amenities', json('POST', input)),

  actualizarAmenity: (id: string, cambios: AmenityCambios) =>
    api<Amenity>(`/amenities/${id}`, json('PATCH', cambios)),

  disponibilidad: (amenityId: string, fecha: string) =>
    api<Disponibilidad>(`/amenities/${amenityId}/disponibilidad${query({ fecha })}`),

  /** Hasta 62 días: el calendario mensual del vecino. */
  calendario: (amenityId: string, desde: string, hasta: string) =>
    api<CalendarioAmenity>(`/amenities/${amenityId}/calendario${query({ desde, hasta })}`),

  // ── Bloqueos ──
  listarBloqueos: (amenityId: string, filtros: { desde?: string; hasta?: string } = {}) =>
    api<Bloqueo[]>(`/amenities/${amenityId}/bloqueos${query(filtros)}`),

  crearBloqueo: (amenityId: string, input: BloqueoInput) =>
    api<Bloqueo>(`/amenities/${amenityId}/bloqueos`, json('POST', input)),

  borrarBloqueo: (amenityId: string, id: string) =>
    api<void>(`/amenities/${amenityId}/bloqueos/${id}`, { method: 'DELETE' }),

  // ── Reservas ──
  listar: (
    filtros: {
      consorcioId?: string;
      amenityId?: string;
      unidadId?: string;
      estado?: EstadoReserva;
      situacion?: 'proximas' | 'pasadas';
      desde?: string;
      hasta?: string;
      pagina?: number;
      limite?: number;
    } = {},
  ) => api<Paginado<Reserva>>(`/reservas${query(filtros)}`),

  crear: (input: ReservaInput) => api<Reserva>('/reservas', json('POST', input)),

  aprobar: (id: string) => api<Reserva>(`/reservas/${id}/aprobar`, json('PATCH')),

  rechazar: (id: string, motivoRechazo: string) =>
    api<Reserva>(`/reservas/${id}/rechazar`, json('PATCH', { motivoRechazo })),

  cancelar: (id: string) => api<Reserva>(`/reservas/${id}/cancelar`, json('PATCH')),
};
