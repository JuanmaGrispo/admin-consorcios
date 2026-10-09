import { api, descargar, query } from '@/lib/api';
import type { Paginado } from '@/types/comun';
import type {
  Boleta,
  EstadoLiquidacion,
  FilaCobranza,
  FiltrosBoletas,
  Gasto,
  GastoInput,
  Liquidacion,
  LiquidacionCambios,
  LiquidacionDetalle,
  LiquidacionInput,
  ResumenCobranzas,
  SituacionBoleta,
} from '@/types/expensa';

/** Lo que va en el query string: sin la paginación, que el resumen y la exportación ignoran. */
const filtros = (f: FiltrosBoletas) => query({ ...f });

/** Una función por endpoint de /expensas. Los dos portales usan el mismo. */
export const expensasService = {
  // ── Liquidaciones (administrador) ──

  listarLiquidaciones: (f: { consorcioId?: string; estado?: EstadoLiquidacion } = {}) =>
    api<Liquidacion[]>(`/expensas/liquidaciones${query(f)}`),

  obtenerLiquidacion: (id: string) => api<LiquidacionDetalle>(`/expensas/liquidaciones/${id}`),

  /** Nace en borrador. Una por consorcio y período. */
  crearLiquidacion: (input: LiquidacionInput) =>
    api<LiquidacionDetalle>('/expensas/liquidaciones', { method: 'POST', body: JSON.stringify(input) }),

  /** Sólo antes de emitir; si estaba previsualizada, recalcula las boletas. */
  actualizarLiquidacion: (id: string, cambios: LiquidacionCambios) =>
    api<LiquidacionDetalle>(`/expensas/liquidaciones/${id}`, { method: 'PATCH', body: JSON.stringify(cambios) }),

  /** Sólo sin emitir: se lleva sus gastos y boletas. */
  borrarLiquidacion: (id: string) => api<void>(`/expensas/liquidaciones/${id}`, { method: 'DELETE' }),

  /** Calcula las boletas. Se puede repetir; los ajustes manuales se conservan. */
  previsualizar: (id: string) =>
    api<LiquidacionDetalle>(`/expensas/liquidaciones/${id}/previsualizar`, { method: 'POST' }),

  /** Congela las boletas y avisa a los vecinos. No se puede deshacer. */
  emitir: (id: string) => api<LiquidacionDetalle>(`/expensas/liquidaciones/${id}/emitir`, { method: 'POST' }),

  cerrar: (id: string) => api<LiquidacionDetalle>(`/expensas/liquidaciones/${id}/cerrar`, { method: 'POST' }),

  agregarGasto: (liquidacionId: string, input: GastoInput) =>
    api<Gasto>(`/expensas/liquidaciones/${liquidacionId}/gastos`, { method: 'POST', body: JSON.stringify(input) }),

  actualizarGasto: (liquidacionId: string, gastoId: string, cambios: Partial<GastoInput>) =>
    api<Gasto>(`/expensas/liquidaciones/${liquidacionId}/gastos/${gastoId}`, {
      method: 'PATCH',
      body: JSON.stringify(cambios),
    }),

  borrarGasto: (liquidacionId: string, gastoId: string) =>
    api<void>(`/expensas/liquidaciones/${liquidacionId}/gastos/${gastoId}`, { method: 'DELETE' }),

  // ── Boletas ──

  /** La grilla de cobranzas. Al vecino le llegan sólo las emitidas de sus unidades. */
  listarBoletas: (f: FiltrosBoletas = {}) => api<Paginado<FilaCobranza>>(`/expensas/boletas${filtros(f)}`),

  /** Totales y conteos de cada solapa: ignora `situacion` y `estado`. */
  resumen: (f: FiltrosBoletas = {}) => api<ResumenCobranzas>(`/expensas/boletas/resumen${filtros(f)}`),

  /** La grilla en CSV para Excel, con los filtros que se estén viendo. */
  exportar: (f: FiltrosBoletas = {}) =>
    descargar(`/expensas/boletas/exportar${filtros({ ...f, pagina: undefined, limite: undefined })}`, 'cobranzas.csv'),

  /** Avisa a los vecinos que deben, nunca a quien ya pagó. Devuelve cuántos avisos salieron y cuántos no. */
  enviarRecordatorios: (alcance: {
    boletaId?: string;
    liquidacionId?: string;
    consorcioId?: string;
    periodo?: string;
    situacion?: Exclude<SituacionBoleta, 'pagados'>;
    mensaje?: string;
  }) =>
    api<{ boletas: number; avisos: number; sinDestinatario: number; fallidos: number }>(
      '/expensas/boletas/recordatorios',
      {
        method: 'POST',
        body: JSON.stringify(alcance),
      },
    ),

  obtenerBoleta: (id: string) => api<Boleta>(`/expensas/boletas/${id}`),

  descargarBoleta: (id: string, nombre: string) => descargar(`/expensas/boletas/${id}/pdf`, `boleta-${nombre}.pdf`),

  /** Sólo en previsualización. El motivo lo ve el vecino. */
  ajustarBoleta: (id: string, ajusteManual: number, motivoAjuste?: string) =>
    api<Boleta>(`/expensas/boletas/${id}/ajuste`, {
      method: 'PATCH',
      body: JSON.stringify({ ajusteManual, motivoAjuste }),
    }),
};
