/** Una sección del manual que respalda la respuesta. */
export interface FuenteAsistente {
  seccion: string;
  ancla: string;
}

/** Un botón que lleva a una pantalla. Sólo navega: no carga ni envía nada. */
export interface AccionAsistente {
  tipo: 'IR_A';
  etiqueta: string;
  ruta: string;
}

/** Lo que devuelve `POST /asistente/preguntas`. */
export interface RespuestaAsistente {
  interaccion_id: string;
  conversacion_id: string;
  respuesta: string;
  fuentes: FuenteAsistente[];
  acciones: AccionAsistente[];
  /** Las consultas de lectura que corrieron: `consultar_saldo`, `mis_reclamos`… */
  datos_consultados: string[];
  confianza: 'alta' | 'media' | 'baja';
  derivar_a_humano: boolean;
  /** Quién respondió: el modelo de IA, la búsqueda en el manual (sin IA) o una negativa. */
  origen: 'llm' | 'manual' | 'rechazo';
}

export interface PreguntaAsistente {
  pregunta: string;
  conversacion_id?: string;
  pantalla?: string;
}

/** `GET /asistente/metricas`, sólo para el superadministrador. */
export interface MetricasAsistente {
  dias: number;
  preguntas: number;
  porOrigen: Record<RespuestaAsistente['origen'], number>;
  costoUsd: number;
  latenciaPromedioMs: number;
  feedback: { util: number; noUtil: number };
  errores: { error: string; veces: number }[];
  habilitado: boolean;
  modeloConfigurado: boolean;
  disyuntorAbierto: boolean;
  topeDiarioUsd: number;
  costoHoyUsd: number;
}
