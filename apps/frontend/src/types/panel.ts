/** El estado de cobranza de un consorcio en el período (mismas claves que EstadoBadge `cobranza`). */
export type EstadoCobranza = 'AL_DIA' | 'ATENCION' | 'MOROSIDAD_ALTA' | 'SIN_EMITIR';

/** Lo que el panel pide mirar. Cada tipo trae lo justo para armar su renglón y su link. */
export type Atencion =
  | { tipo: 'DEUDA_ANTIGUA'; consorcioId: string; consorcio: string; unidades: number; saldo: number; dias: number }
  | {
      tipo: 'LIQUIDACION_SIN_EMITIR';
      consorcioId: string;
      consorcio: string;
      /** AAAA-MM */
      periodo: string;
      /** null si la liquidación del período ni siquiera se abrió. */
      fechaVencimiento: string | null;
    }
  | {
      tipo: 'QUORUM_BAJO';
      asambleaId: string;
      consorcioId: string;
      consorcio: string;
      fecha: string;
      quorumPorcentaje: number;
      quorumRequerido: number;
    }
  | {
      tipo: 'RECLAMO_SIN_ASIGNAR';
      reclamoId: string;
      codigo: string;
      consorcioId: string;
      consorcio: string;
      unidad: string;
      categoria: string;
      creadoAt: string;
    };

/** Una fila de "Mis consorcios". */
export interface ConsorcioDelPanel {
  id: string;
  nombre: string;
  calle: string | null;
  numero: string | null;
  barrio: string | null;
  unidades: number;
  emitido: number;
  cobrado: number;
  pendiente: number;
  /** Porcentaje (13.7 es 13,7%). */
  morosidad: number;
  estado: EstadoCobranza;
}

/** GET /panel: todos los consorcios del administrador de un vistazo (pantalla 01). */
export interface Panel {
  /** AAAA-MM: el último período emitido si no se pidió otro. */
  periodo: string;
  consorcios: number;
  unidades: number;
  cobranza: {
    emitido: number;
    cobrado: number;
    pendiente: number;
    vencido: number;
    unidadesVencidas: number;
    /** Porcentajes (86.3 es 86,3%). */
    porcentajeCobrado: number;
    morosidad: number;
    /** El período anterior, para el "+4,8% vs julio"; null si no se emitió. */
    anterior: { periodo: string; emitido: number; cobrado: number; morosidad: number } | null;
  };
  actividadHoy: {
    reclamosAbiertos: number;
    reservas: number;
    reservasPendientes: number;
    votacionesActivas: number;
  };
  /** Los últimos 6 períodos, del más viejo al actual. */
  serie: { periodo: string; emitido: number; cobrado: number }[];
  atencion: Atencion[];
  porConsorcio: ConsorcioDelPanel[];
}
