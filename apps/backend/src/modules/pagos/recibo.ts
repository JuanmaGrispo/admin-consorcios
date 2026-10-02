/**
 * El número de recibo que ve el vecino: punto de venta y número correlativo,
 * como en cualquier comprobante. El correlativo sale de una secuencia de la
 * base (`recibo_pago_numero`); acá sólo se le da forma.
 */

/** Mientras haya un solo punto de venta, es este. */
export const PUNTO_DE_VENTA = '0001';

/**
 * `12` → `0001-00000012`. Ocho dígitos alcanzan para cien millones de
 * recibos; si alguna vez se pasa, el número crece y deja de estar alineado,
 * que es mejor que truncarlo.
 */
export function formatearNumeroRecibo(correlativo: number): string {
  return `${PUNTO_DE_VENTA}-${String(correlativo).padStart(8, '0')}`;
}
