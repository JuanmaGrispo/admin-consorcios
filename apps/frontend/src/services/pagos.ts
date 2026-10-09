import { api } from '@/lib/api';

/**
 * Una función por endpoint de /pagos. Por ahora sólo el checkout, que usa la
 * seña de una reserva; el módulo de expensas suma acá el resto.
 */
export const pagosService = {
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
