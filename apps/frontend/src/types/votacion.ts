export type EstadoVotacion = 'BORRADOR' | 'ABIERTA' | 'CERRADA';
export type ResultadoVotacion = 'APROBADA' | 'RECHAZADA' | 'SIN_QUORUM';
export type PadronVotacion = 'SOLO_PROPIETARIOS' | 'TODAS_LAS_UNIDADES';
export type FormaConteo = 'POR_COEFICIENTE' | 'POR_UNIDAD';
export type MayoriaRequerida = 'SIMPLE_PRESENTES' | 'ABSOLUTA' | 'DOS_TERCIOS';
export type CriterioDesempate = 'RECHAZADA' | 'APROBADA';

export interface OpcionVoto {
  id: string;
  etiqueta: string;
  orden: number;
  /** "A favor" y "En contra" no se editan. */
  esFija: boolean;
}

export interface ConteoOpcion {
  opcionId: string;
  etiqueta: string;
  peso: number;
  votos: number;
  /** Sobre lo emitido. */
  porcentaje: number;
}

export interface Escrutinio {
  opciones: ConteoOpcion[];
  pesoEmitido: number;
  /** Peso emitido sobre el del padrón, en %. */
  participacion: number;
  resultado: ResultadoVotacion;
}

/** Una votación del listado (GET /votaciones). */
export interface Votacion {
  id: string;
  consorcioId: string;
  asambleaId: string | null;
  puntoOrdenDiaId: string | null;
  titulo: string;
  descripcion: string | null;
  adjuntoUrl: string | null;
  padron: PadronVotacion;
  formaConteo: FormaConteo;
  mayoria: MayoriaRequerida;
  desempate: CriterioDesempate;
  permiteVotoAnticipado: boolean;
  mostrarParcial: boolean;
  bloqueaConDeuda: boolean;
  apertura: string;
  cierre: string;
  estado: EstadoVotacion;
  resultado: ResultadoVotacion | null;
  opcionVotos: OpcionVoto[];
}

export interface VotoEmitido {
  unidadId: string;
  opcionId: string;
  anticipado: boolean;
  createdAt: string;
  emitidoPor: { id: string; nombre?: string; apellido?: string };
  cargadoPorLaAdministracion: boolean;
}

/** Una unidad del vecino con la que puede votar, y si ya votó. */
export interface MiUnidadVotacion {
  unidadId: string;
  etiqueta: string;
  /** Lo que pesa su voto sobre el padrón, en %. */
  pesoPorcentaje: number;
  voto: VotoEmitido | null;
}

/** En el detalle, `padron` deja de ser el enum y pasa a ser el resumen del padrón. */
export interface ResumenPadron {
  unidades: number;
  pesoTotal: number;
}

/**
 * GET /votaciones/:id. El administrador recibe el resumen del padrón y el
 * escrutinio; el vecino, `misUnidades` y un `escrutinio` que es null si
 * todavía no puede ver el parcial.
 */
export type VotacionDetalle = Omit<Votacion, 'padron'> & {
  padron: ResumenPadron;
  escrutinio: Escrutinio | null;
  misUnidades?: MiUnidadVotacion[];
};

/** Una fila de GET /votaciones/:id/votos. */
export interface FilaPadron {
  unidadId: string;
  etiqueta: string;
  peso: number;
  voto: VotoEmitido | null;
}

/** GET /votaciones/padron: cuántas unidades votarían con esas reglas. */
export interface VistaPadron {
  habilitadas: number;
  pesoTotal: number;
  sinVotante: { unidadId: string; etiqueta: string }[];
}

/** POST /votaciones */
export interface VotacionInput {
  consorcioId: string;
  puntoOrdenDiaId?: string;
  asambleaId?: string;
  titulo: string;
  descripcion?: string | null;
  adjuntoUrl?: string | null;
  padron?: PadronVotacion;
  formaConteo?: FormaConteo;
  mayoria?: MayoriaRequerida;
  desempate?: CriterioDesempate;
  permiteVotoAnticipado?: boolean;
  mostrarParcial?: boolean;
  bloqueaConDeuda?: boolean;
  /** Obligatorias si es independiente. */
  apertura?: string;
  cierre?: string;
  /** Además de “A favor” y “En contra”, que siempre están. */
  opciones?: string[];
}

/** PATCH /votaciones/:id: dónde se vota y las opciones no se cambian por acá. */
export type VotacionCambios = Partial<
  Omit<VotacionInput, 'consorcioId' | 'puntoOrdenDiaId' | 'asambleaId' | 'opciones'>
>;
