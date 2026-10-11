import type { EstadoAsamblea, EstadoAsistencia } from './asamblea';
import type { EstadoBoleta } from './expensa';
import type { Novedad } from './novedad';
import type { VinculoUnidad } from './unidad';

/** La boleta vigente de una unidad y cuánto queda por pagar. */
export interface SaldoDeUnidad {
  boletaId: string;
  /** AAAA-MM */
  periodo: string;
  fechaVencimiento: string;
  total: number;
  pagado: number;
  saldo: number;
  estado: EstadoBoleta;
  /** Negativo si ya venció. */
  diasParaVencer: number;
  /** El último pago aprobado ("Pagaste … el 04/09" y "Ver recibo"). */
  ultimoPago: { id: string; fecha: string } | null;
}

export interface UnidadDeInicio {
  id: string;
  etiqueta: string;
  coeficiente: number;
  vinculo: VinculoUnidad;
  esTitular: boolean;
  consorcio: { id: string; nombre: string; calle: string | null; numero: string | null; barrio: string | null };
  /** null si el consorcio nunca emitió expensas. */
  expensas: SaldoDeUnidad | null;
  reclamosAbiertos: number;
}

/** Lo que se le viene: una asamblea citada, una reserva aprobada o una votación abierta. */
export type EventoProximo =
  | {
      tipo: 'ASAMBLEA';
      id: string;
      titulo: string;
      fecha: string;
      lugar: string | null;
      estado: EstadoAsamblea;
      consorcioId: string;
      quorumPorcentaje: number | null;
      quorumRequerido: number;
      /** null si su unidad no está convocada. */
      miAsistencia: EstadoAsistencia | null;
    }
  | { tipo: 'RESERVA'; id: string; titulo: string; fecha: string; fin: string; unidadId: string; amenityId: string }
  | { tipo: 'VOTACION'; id: string; titulo: string; fecha: string; consorcioId: string; asambleaId: string | null };

/** Un amenity para los accesos rápidos ("Reservar SUM · Libre hoy"). */
export interface AmenityDeInicio {
  id: string;
  nombre: string;
  icono: string | null;
  consorcioId: string;
  reservasHoy: number;
  bloqueadoHoy: boolean;
  libreHoy: boolean;
}

/** GET /inicio: todo lo que el celular necesita apenas abre la app (pantalla 10). */
export interface Inicio {
  usuario: { id: string; nombre: string; apellido: string; avatarUrl: string | null };
  unidades: UnidadDeInicio[];
  /** De la más cercana a la más lejana, hasta 10. */
  proximosEventos: EventoProximo[];
  amenities: AmenityDeInicio[];
  /** Lo último del muro de sus edificios, fijadas primero. */
  novedades: Novedad[];
}
