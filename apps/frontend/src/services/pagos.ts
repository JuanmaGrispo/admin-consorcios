import { api, descargar, query } from '@/lib/api';
import type { EstadoPago, Pago, PagoManualInput } from '@/types/pago';

/** Una función por endpoint de /pagos: expensas y señas de reservas. */
export const pagosService = {
  /** El administrador ve todos; el vecino, los de sus unidades. */
  listar: (filtros: { boletaId?: string; unidadId?: string; estado?: EstadoPago } = {}) =>
    api<Pago[]>(`/pagos${query(filtros)}`),

  obtener: (id: string) => api<Pago>(`/pagos/${id}`),

  /** Sólo de un pago aprobado. */
  descargarRecibo: (id: string, numero?: string | null) =>
    descargar(`/pagos/${id}/recibo`, `recibo-${numero ?? id}.pdf`),

  /**
   * Al volver del checkout: le pregunta a Mercado Pago cómo quedó el pago sin
   * esperar al webhook. Sobre uno que no está pendiente, lo devuelve tal cual.
   */
  sincronizar: (id: string) => api<Pago>(`/pagos/${id}/sincronizar`, { method: 'POST' }),

  /** La administración registra una transferencia o un pago en efectivo. */
  registrar: (input: PagoManualInput) => api<Pago>('/pagos', { method: 'POST', body: JSON.stringify(input) }),

  /**
   * Arranca (o retoma) el cobro con Mercado Pago de una boleta o de la seña
   * de una reserva. Devuelve la URL del checkout a la que se manda al vecino.
   */
  checkoutMercadoPago: (destino: { boletaId: string } | { reservaId: string }) =>
    api<{ pagoId: string; initPoint: string }>('/pagos/mercadopago/preferencia', {
      method: 'POST',
      body: JSON.stringify(destino),
    }),
};
