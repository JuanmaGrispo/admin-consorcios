export type EstadoAsamblea = 'BORRADOR' | 'CONVOCADA' | 'EN_CURSO' | 'CERRADA' | 'CERRADA_SIN_QUORUM';
export type TipoAsamblea = 'ORDINARIA' | 'EXTRAORDINARIA';
export type ModalidadAsamblea = 'PRESENCIAL' | 'HIBRIDA' | 'DIGITAL';
export type TipoPuntoOrden = 'INFORMATIVO' | 'CON_VOTACION';
export type EstadoAsistencia = 'ASISTE' | 'NO_ASISTE' | 'SIN_RESPONDER' | 'CON_PODER';

export interface PuntoOrdenDia {
  id: string;
  asambleaId: string;
  orden: number;
  titulo: string;
  descripcion: string | null;
  tipo: TipoPuntoOrden;
}

/** El quórum en vivo de una asamblea convocada (GET /asambleas/:id). */
export interface Quorum {
  /** Porcentaje de coeficientes presentes. */
  porcentaje: number;
  requerido: number;
  alcanzado: boolean;
  faltanPuntos: number;
  /** Cuántas unidades sin responder harían falta; null si ni confirmando todas se llega. */
  faltanUnidades: number | null;
  conteo: Record<EstadoAsistencia, number>;
}

/** Una fila del listado (GET /asambleas). */
export interface Asamblea {
  id: string;
  consorcioId: string;
  titulo: string;
  tipo: TipoAsamblea;
  modalidad: ModalidadAsamblea;
  fechaHora: string;
  lugar: string | null;
  linkVideollamada: string | null;
  quorumRequerido: number;
  estado: EstadoAsamblea;
  actaUrl: string | null;
  createdAt: string;
  /** Null mientras no se convocó (no hay padrón de asistencia). */
  quorumPorcentaje: number | null;
}

export interface UnidadResumen {
  id: string;
  etiqueta: string;
}

export interface Asistencia {
  id: string;
  unidadId: string;
  unidad: UnidadResumen | null;
  estado: EstadoAsistencia;
  coeficienteAplicado: number;
  apoderadoUnidad: UnidadResumen | null;
  confirmadaPor: { id: string; nombre: string; apellido: string } | null;
  confirmadaAt: string | null;
}

/** GET /asambleas/:id. Lo que viene de más según el rol está como opcional. */
export interface AsambleaDetalle extends Omit<Asamblea, 'quorumPorcentaje'> {
  puntoOrdenDias: PuntoOrdenDia[];
  quorum: Quorum | null;
  /** Sólo el administrador: las últimas confirmaciones de asistencia. */
  ultimasConfirmaciones?: Asistencia[];
  /** Sólo el vecino: cómo respondió por cada una de sus unidades. */
  miAsistencia?: Asistencia[];
}

export interface PuntoInput {
  titulo: string;
  descripcion?: string;
  tipo?: TipoPuntoOrden;
}

/** POST /asambleas */
export interface AsambleaInput {
  consorcioId: string;
  titulo: string;
  tipo?: TipoAsamblea;
  modalidad?: ModalidadAsamblea;
  fechaHora: string;
  lugar?: string | null;
  linkVideollamada?: string | null;
  quorumRequerido?: number;
  puntos?: PuntoInput[];
}

/** PATCH /asambleas/:id: el consorcio y el orden del día no se cambian por acá. */
export type AsambleaCambios = Partial<Omit<AsambleaInput, 'consorcioId' | 'puntos'>>;
