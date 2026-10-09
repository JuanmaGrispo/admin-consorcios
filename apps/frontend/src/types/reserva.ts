export type EstadoReserva = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'CANCELADA' | 'FINALIZADA';

/** Un espacio común reservable (GET /amenities). Las horas vienen "HH:MM:SS". */
export interface Amenity {
  id: string;
  consorcioId: string;
  nombre: string;
  /** Nombre de Material Symbols, como en el prototipo: "deck", "outdoor_grill". */
  icono: string | null;
  cupoPersonas: number | null;
  /** Reservas simultáneas: la cochera de visitas tiene 2 lugares. */
  lugares: number;
  horaApertura: string;
  horaCierre: string;
  anticipacionMinimaHoras: number;
  cancelacionMinimaHoras: number;
  /** Turnos fijos desde la apertura; null es horario libre. */
  duracionFranjaMinutos: number | null;
  duracionMaximaHoras: number | null;
  requiereAprobacion: boolean;
  montoSena: number;
  diasDevolucionSena: number;
  bloqueaConDeuda: boolean;
  reglamento: string | null;
  activo: boolean;
}

/** POST /amenities */
export interface AmenityInput {
  consorcioId: string;
  nombre: string;
  icono?: string;
  cupoPersonas?: number;
  lugares?: number;
  reglamento?: string | null;
  horaApertura?: string;
  horaCierre?: string;
  anticipacionMinimaHoras?: number;
  cancelacionMinimaHoras?: number;
  duracionFranjaMinutos?: number | null;
  duracionMaximaHoras?: number;
  requiereAprobacion?: boolean;
  montoSena?: number;
  diasDevolucionSena?: number;
  bloqueaConDeuda?: boolean;
}

/** PATCH /amenities/:id */
export type AmenityCambios = Partial<Omit<AmenityInput, 'consorcioId'>> & { activo?: boolean };

export interface SenaDeReserva {
  monto: number;
  pagada: boolean;
  pagoId: string | null;
  devueltaAt: string | null;
}

/** GET /reservas: la reserva con su amenity, la unidad y quién la pidió. */
export interface Reserva {
  id: string;
  amenityId: string;
  amenity: Amenity;
  unidadId: string;
  unidad: { id: string; etiqueta: string };
  solicitadaPorId: string;
  solicitadaPor: { id: string; nombre: string; apellido: string };
  inicio: string;
  fin: string;
  estado: EstadoReserva;
  motivo: string | null;
  motivoRechazo: string | null;
  lugar: number;
  /** Null si el amenity no pide seña. */
  sena: SenaDeReserva | null;
  /** Hasta cuándo el vecino la puede cancelar; null si ya no se cancela. */
  cancelableHasta: string | null;
}

/** POST /reservas. Fecha y horas de pared del edificio. */
export interface ReservaInput {
  amenityId: string;
  unidadId?: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  motivo?: string;
}

export type EstadoDeFranja = 'LIBRE' | 'OCUPADA' | 'BLOQUEADA' | 'PASADA';

/** GET /amenities/:id/disponibilidad */
export interface Disponibilidad {
  fecha: string;
  horaApertura: string;
  horaCierre: string;
  cierraAlDiaSiguiente: boolean;
  duracionMaximaHoras: number | null;
  duracionFranjaMinutos: number | null;
  anticipacionMinimaHoras: number;
  requiereAprobacion: boolean;
  lugares: number;
  /** Con turnos fijos, cada franja resuelta; null con horario libre. */
  franjas:
    | { horaInicio: string; horaFin: string; inicio: string; fin: string; estado: EstadoDeFranja; lugaresLibres: number }[]
    | null;
  ocupado: { reservaId: string; inicio: string; fin: string; estado: EstadoReserva; lugar: number }[];
  bloqueos: { desde: string; hasta: string; motivo: string | null }[];
}

export type EstadoDelDia = 'DISPONIBLE' | 'PARCIAL' | 'SIN_LUGAR' | 'PASADO';

/** GET /amenities/:id/calendario */
export interface CalendarioAmenity {
  amenityId: string;
  horaApertura: string;
  horaCierre: string;
  cierraAlDiaSiguiente: boolean;
  dias: { fecha: string; estado: EstadoDelDia }[];
}

/** GET /amenities/:id/bloqueos */
export interface Bloqueo {
  id: string;
  amenityId: string;
  desde: string;
  hasta: string;
  motivo: string | null;
}

/** POST /amenities/:id/bloqueos. Fechas y horas de pared: "2026-09-10T10:00". */
export interface BloqueoInput {
  desde: string;
  hasta: string;
  motivo?: string;
  /** Cancela las reservas que pisa en vez de rechazar el alta con 409. */
  cancelarReservas?: boolean;
}
