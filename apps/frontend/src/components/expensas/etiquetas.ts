import type { CriterioProrrateo, EstadoLiquidacion } from '@/types/expensa';
import type { MedioPago } from '@/types/pago';

export const CRITERIOS: Record<CriterioProrrateo, { etiqueta: string; ayuda: string }> = {
  COEFICIENTE: {
    etiqueta: 'Por coeficiente',
    ayuda: 'Cada unidad paga según su porcentaje de participación.',
  },
  PARTES_IGUALES: {
    etiqueta: 'Partes iguales',
    ayuda: 'Todas las unidades activas pagan lo mismo.',
  },
};

export const MEDIOS: Record<MedioPago, string> = {
  MERCADO_PAGO: 'Mercado Pago',
  TRANSFERENCIA: 'Transferencia',
  EFECTIVO: 'Efectivo',
  OTRO: 'Otro',
};

/** Los cuatro pasos de la pantalla 03 y en cuál está cada estado. */
export const PASOS = ['Carga de gastos', 'Prorrateo', 'Previsualización', 'Emisión'] as const;

export function pasoDe(estado: EstadoLiquidacion): number {
  switch (estado) {
    case 'BORRADOR':
    case 'PRORRATEO':
      return 1;
    case 'PREVISUALIZACION':
      return 2;
    case 'EMITIDA':
    case 'CERRADA':
      return 3;
  }
}

/** Antes de emitir se pueden tocar gastos, criterio y vencimiento. */
export const esEditable = (estado: EstadoLiquidacion) => estado === 'BORRADOR' || estado === 'PREVISUALIZACION';
