import { EstadoBoleta } from '../../database/entities';
import { aCentavos } from './prorrateo';

/**
 * El estado de una boleta emitida sale de cuánto se pagó y de si ya venció.
 * `pagado` es la suma de sus pagos APROBADO: un reintegro lo baja y la boleta
 * vuelve atrás sola. Fechas ISO (YYYY-MM-DD), que se comparan como texto.
 *
 * Vencida le gana a parcial: lo que importa es que hay saldo y está atrasado.
 */
export function estadoBoleta(
  total: number,
  pagado: number,
  fechaVencimiento: string,
  hoy: string,
): EstadoBoleta {
  if (aCentavos(pagado) >= aCentavos(total)) return EstadoBoleta.PAGADA;
  if (hoy > fechaVencimiento) return EstadoBoleta.VENCIDA;
  return aCentavos(pagado) > 0 ? EstadoBoleta.PARCIAL : EstadoBoleta.PENDIENTE;
}
