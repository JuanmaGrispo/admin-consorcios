import type { NaturalezaGasto, Proveedor, RubroGasto } from './catalogo';
import type { MedioPago } from './pago';

/** `PRORRATEO` existe en la base pero el flujo no lo usa: va de borrador a previsualización. */
export type EstadoLiquidacion = 'BORRADOR' | 'PRORRATEO' | 'PREVISUALIZACION' | 'EMITIDA' | 'CERRADA';
export type CriterioProrrateo = 'COEFICIENTE' | 'PARTES_IGUALES';
export type EstadoBoleta = 'PENDIENTE' | 'PARCIAL' | 'PAGADA' | 'VENCIDA';
/** Las solapas de la grilla de cobranzas: `pendientes` incluye las pagadas a medias. */
export type SituacionBoleta = 'pagados' | 'pendientes' | 'vencidos';

/** Una liquidación del listado (GET /expensas/liquidaciones). */
export interface Liquidacion {
  id: string;
  consorcioId: string;
  /** Fecha del día 1 del período (`2026-08-01`). */
  periodo: string;
  estado: EstadoLiquidacion;
  criterioProrrateo: CriterioProrrateo;
  fechaVencimiento: string;
  fechaEmision: string | null;
  totalGastos: number;
  totalEmitido: number;
  createdAt: string;
  cantidadGastos?: number;
  cantidadBoletas?: number;
}

export interface Gasto {
  id: string;
  liquidacionId: string;
  rubroId: string;
  rubro: RubroGasto;
  proveedorId: string | null;
  proveedor: Proveedor | null;
  reclamoId: string | null;
  votacionId: string | null;
  descripcion: string;
  monto: number;
  naturaleza: NaturalezaGasto;
  comprobanteUrl: string | null;
  comprobanteNumero: string | null;
  cuotaNumero: number | null;
  cuotaTotal: number | null;
}

/** GET /expensas/liquidaciones/:id: la liquidación con sus gastos. */
export interface LiquidacionDetalle extends Liquidacion {
  gastos: Gasto[];
}

/** POST /expensas/liquidaciones */
export interface LiquidacionInput {
  consorcioId: string;
  /** AAAA-MM */
  periodo: string;
  criterioProrrateo?: CriterioProrrateo;
  /** Sin esto, el día de vencimiento del consorcio en el mes siguiente. */
  fechaVencimiento?: string;
}

/** PATCH /expensas/liquidaciones/:id: sólo antes de emitir. */
export type LiquidacionCambios = Partial<Pick<LiquidacionInput, 'criterioProrrateo' | 'fechaVencimiento'>>;

/** POST /expensas/liquidaciones/:id/gastos */
export interface GastoInput {
  rubroId: string;
  proveedorId?: string;
  descripcion: string;
  monto: number;
  /** Sin esto, toma la del rubro. */
  naturaleza?: NaturalezaGasto;
  comprobanteUrl?: string;
  comprobanteNumero?: string;
  cuotaNumero?: number;
  cuotaTotal?: number;
}

export interface VecinoDeFila {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string | null;
}

/** Una fila de la grilla de cobranzas (GET /expensas/boletas). */
export interface FilaCobranza {
  id: string;
  unidad: { id: string; etiqueta: string; coeficiente: number };
  /** AAAA-MM */
  periodo: string;
  fechaVencimiento: string;
  coeficienteAplicado: number;
  /** Sólo para quien administra. */
  propietario?: VecinoDeFila | null;
  inquilino?: VecinoDeFila | null;
  emitido: number;
  pagado: number;
  saldo: number;
  medio: MedioPago | null;
  ultimoPago: { id: string; fecha: string } | null;
  estado: EstadoBoleta;
  interesesMora: number;
}

/** GET /expensas/boletas/resumen: la cabecera de cobranzas. */
export interface ResumenCobranzas {
  emitido: number;
  cobrado: number;
  saldoPendiente: number;
  interesesAcumulados: number;
  conteos: { todos: number; pagados: number; pendientes: number; vencidos: number };
}

export interface BoletaDetalleLinea {
  id: string;
  gastoId: string | null;
  /** Con el rubro: lo que permite agrupar "Gastos por rubro". */
  gasto: (Pick<Gasto, 'id' | 'descripcion' | 'naturaleza'> & { rubro: RubroGasto }) | null;
  concepto: string;
  monto: number;
}

/** GET /expensas/boletas/:id: la boleta con su detalle. */
export interface Boleta {
  id: string;
  liquidacionId: string;
  liquidacion: Liquidacion;
  unidadId: string;
  unidad: { id: string; etiqueta: string; consorcioId: string };
  coeficienteAplicado: number;
  importeOrdinarias: number;
  importeExtraordinarias: number;
  fondoReserva: number;
  saldoAnterior: number;
  interesesMora: number;
  ajusteManual: number;
  motivoAjuste: string | null;
  total: number;
  estado: EstadoBoleta;
  boletaDetalles: BoletaDetalleLinea[];
}

/** Filtros de la grilla, el resumen, la exportación y los recordatorios. */
export interface FiltrosBoletas {
  liquidacionId?: string;
  consorcioId?: string;
  unidadId?: string;
  /** AAAA-MM */
  periodo?: string;
  estado?: EstadoBoleta;
  situacion?: SituacionBoleta;
  buscar?: string;
  pagina?: number;
  limite?: number;
}
