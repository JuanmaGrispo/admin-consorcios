import { randomUUID } from 'node:crypto';

/** Contrato de los eventos de dominio: ver docs/mensajeria.md. */

interface DatosAsamblea {
  asamblea_id: string;
  titulo: string;
  /** AAAA-MM-DD y HH:mm, en hora de Buenos Aires. */
  fecha: string;
  hora: string;
  lugar: string | null;
}

export interface PayloadsEventos {
  'expensas.emitidas': {
    liquidacion_id: string;
    periodo: string;
    unidades_afectadas: string[];
    fecha_vencimiento: string;
  };
  'asamblea.creada': DatosAsamblea;
  'asamblea.recordatorio': DatosAsamblea;
  'votacion.nueva': {
    votacion_id: string;
    titulo: string;
    fecha_cierre: string;
    mayoria_necesaria: string;
  };
  'votacion.cerrada': {
    votacion_id: string;
    titulo: string;
    resultado: 'aprobada' | 'rechazada' | 'sin_quorum';
    participacion_pct: number;
  };
  'reclamo.cerrado': {
    reclamo_id: string;
    codigo: string;
    unidad_id: string;
    usuario_id: string;
    categoria: string;
    resolucion: string | null;
  };
  'novedad.publicada': { novedad_id: string; titulo: string };
  /** Un aviso a una persona: lo que antes era `Notificador.enviar`. */
  'aviso.directo': { destinatario_id: string; asunto: string; cuerpo: string; origen: string };
}

export type TipoEvento = keyof PayloadsEventos;

export interface Sobre<T extends TipoEvento = TipoEvento> {
  evento_id: string;
  tipo_evento: T;
  /** `null` sólo en `aviso.directo`: es de una persona, no de un edificio. */
  consorcio_id: string | null;
  timestamp: string;
  payload: PayloadsEventos[T];
}

/** Unión discriminada por `tipo_evento`: con un `switch` TypeScript sabe qué payload trae. */
export type EventoDomus = { [T in TipoEvento]: Sobre<T> }[TipoEvento];

const CAMPOS: { [T in TipoEvento]: (keyof PayloadsEventos[T])[] } = {
  'expensas.emitidas': ['liquidacion_id', 'periodo', 'unidades_afectadas', 'fecha_vencimiento'],
  'asamblea.creada': ['asamblea_id', 'titulo', 'fecha', 'hora'],
  'asamblea.recordatorio': ['asamblea_id', 'titulo', 'fecha', 'hora'],
  'votacion.nueva': ['votacion_id', 'titulo', 'fecha_cierre', 'mayoria_necesaria'],
  'votacion.cerrada': ['votacion_id', 'titulo', 'resultado', 'participacion_pct'],
  'reclamo.cerrado': ['reclamo_id', 'codigo', 'unidad_id', 'usuario_id', 'categoria'],
  'novedad.publicada': ['novedad_id', 'titulo'],
  'aviso.directo': ['destinatario_id', 'asunto', 'cuerpo', 'origen'],
};

export const TIPOS_EVENTO = Object.keys(CAMPOS) as TipoEvento[];

export function crearSobre<T extends TipoEvento>(
  tipo: T,
  consorcioId: string | null,
  payload: PayloadsEventos[T],
): Sobre<T> {
  return {
    evento_id: randomUUID(),
    tipo_evento: tipo,
    consorcio_id: consorcioId,
    timestamp: new Date().toISOString(),
    payload,
  };
}

const esTexto = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/**
 * Devuelve el evento si el sobre está completo, `null` si no. Lo usan el
 * productor antes de publicar y cada consumidor al recibir: un mensaje que no
 * cumple el contrato no se procesa, va a la DLQ.
 */
export function validarSobre(valor: unknown): EventoDomus | null {
  if (typeof valor !== 'object' || valor === null) return null;
  const sobre = valor as Record<string, unknown>;
  const tipo = sobre.tipo_evento as TipoEvento;

  if (!esTexto(sobre.evento_id) || !TIPOS_EVENTO.includes(tipo)) return null;
  if (!esTexto(sobre.timestamp) || Number.isNaN(Date.parse(sobre.timestamp))) return null;
  const consorcioValido =
    tipo === 'aviso.directo' ? sobre.consorcio_id === null || esTexto(sobre.consorcio_id) : esTexto(sobre.consorcio_id);
  if (!consorcioValido) return null;

  const payload = sobre.payload as Record<string, unknown> | null;
  if (typeof payload !== 'object' || payload === null) return null;
  const completo = (CAMPOS[tipo] as string[]).every(
    (campo) => payload[campo] !== undefined && payload[campo] !== null && payload[campo] !== '',
  );
  return completo ? (sobre as unknown as EventoDomus) : null;
}
