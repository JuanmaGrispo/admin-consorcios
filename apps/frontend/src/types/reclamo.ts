import type { CategoriaReclamo, Proveedor } from './catalogo';

export type EstadoReclamo = 'NUEVO' | 'EN_CURSO' | 'ESPERANDO_PROVEEDOR' | 'RESUELTO';
export type PrioridadReclamo = 'BAJA' | 'MEDIA' | 'ALTA';
export type TipoEventoReclamo =
  | 'CREACION'
  | 'ASIGNACION'
  | 'CAMBIO_ESTADO'
  | 'RESPUESTA'
  | 'NOTA_INTERNA';

/** El orden del tablero del administrador y de los filtros: el ciclo de vida del caso. */
export const ESTADOS_RECLAMO: EstadoReclamo[] = ['NUEVO', 'EN_CURSO', 'ESPERANDO_PROVEEDOR', 'RESUELTO'];
export const PRIORIDADES_RECLAMO: PrioridadReclamo[] = ['ALTA', 'MEDIA', 'BAJA'];

/** Lo mínimo de un usuario que viaja dentro de un reclamo (quien lo abrió, el autor de un evento). */
export interface PersonaReclamo {
  id: string;
  nombre: string;
  apellido: string;
  email?: string;
}

export interface ReclamoAdjunto {
  id: string;
  url: string;
  nombre: string | null;
  orden: number;
}

/** GET /reclamos (items) y lo que devuelven las escrituras: el reclamo con sus relaciones. */
export interface Reclamo {
  id: string;
  /** "RC-2026-0184". */
  codigo: string;
  consorcioId: string;
  unidadId: string;
  unidad: { id: string; etiqueta: string };
  creadoPorId: string;
  creadoPor: PersonaReclamo;
  categoriaId: string;
  categoria: CategoriaReclamo;
  proveedorId: string | null;
  proveedor: Proveedor | null;
  descripcion: string;
  prioridad: PrioridadReclamo;
  estado: EstadoReclamo;
  cerradoAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Sólo en el detalle. */
  reclamoAdjuntos?: ReclamoAdjunto[];
}

export interface ReclamoEvento {
  id: string;
  reclamoId: string;
  autorId: string;
  autor: PersonaReclamo;
  tipo: TipoEventoReclamo;
  mensaje: string | null;
  estadoAnterior: EstadoReclamo | null;
  estadoNuevo: EstadoReclamo | null;
  visibleParaVecino: boolean;
  createdAt: string;
}

/** GET /reclamos/:id: el reclamo con su línea de tiempo, la más nueva primero. */
export interface ReclamoDetalle extends Reclamo {
  reclamoAdjuntos: ReclamoAdjunto[];
  eventos: ReclamoEvento[];
}

/** GET /reclamos/resumen */
export interface ResumenReclamos {
  porEstado: Record<EstadoReclamo, number>;
  abiertos: number;
  resueltos: number;
  diasPromedioResolucion: number | null;
}

/** Los filtros de GET /reclamos. */
export interface FiltrosReclamos {
  estado?: EstadoReclamo;
  /** Las solapas del vecino: `abiertos` es todo lo que no está resuelto. */
  situacion?: 'abiertos' | 'cerrados';
  prioridad?: PrioridadReclamo;
  categoriaId?: string;
  consorcioId?: string;
  unidadId?: string;
  proveedorId?: string;
  buscar?: string;
  pagina?: number;
  limite?: number;
}

/** POST /reclamos */
export interface CrearReclamoInput {
  categoriaId: string;
  descripcion: string;
  /** El vecino con una sola unidad puede omitirla; el administrador, nunca. */
  unidadId?: string;
  /** Sólo la toma el administrador. */
  prioridad?: PrioridadReclamo;
  adjuntos?: { url: string; nombre?: string }[];
}
