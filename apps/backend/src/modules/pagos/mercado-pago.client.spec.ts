import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import type { ConfigService } from '@nestjs/config';
import { MercadoPagoClient } from './mercado-pago.client';

const configCon = (valores: Record<string, string>) =>
  ({ get: (nombre: string) => valores[nombre] }) as unknown as ConfigService;

describe('MercadoPagoClient.crearPreferencia', () => {
  const fetchOriginal = globalThis.fetch;
  let cuerpo: Record<string, unknown>;

  beforeEach(() => {
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      cuerpo = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ id: 'pref-1', init_point: 'https://mp/checkout' }), { status: 201 });
    }) as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = fetchOriginal;
  });

  const crear = (valores: Record<string, string>) =>
    new MercadoPagoClient(configCon({ MP_ACCESS_TOKEN: 'token', ...valores })).crearPreferencia({
      titulo: 'Expensas',
      monto: 1000,
      referencia: 'p1',
    });

  it('sin MP_NOTIFICATION_URL no manda notification_url vacío', async () => {
    await crear({ MP_NOTIFICATION_URL: '' });
    assert.equal('notification_url' in cuerpo, false);
  });

  it('con MP_NOTIFICATION_URL la manda', async () => {
    await crear({ MP_NOTIFICATION_URL: 'https://tunel.dev/api/pagos/webhook/mercadopago' });
    assert.equal(cuerpo.notification_url, 'https://tunel.dev/api/pagos/webhook/mercadopago');
  });

  it('variables vacías en el .env usan los valores por defecto de la vuelta', async () => {
    await crear({ FRONTEND_URL: '', MP_RETURN_PATH: '' });
    assert.equal(
      (cuerpo.back_urls as { success: string }).success,
      'http://localhost:3000/vecino/expensas/pago?pago=aprobado',
    );
  });

  it('una FRONTEND_URL con barra final no duplica la barra', async () => {
    await crear({ FRONTEND_URL: 'https://domus.app/' });
    assert.equal(
      (cuerpo.back_urls as { failure: string }).failure,
      'https://domus.app/vecino/expensas/pago?pago=rechazado',
    );
  });

  // Mercado Pago rechaza la preferencia entera ("invalid_auto_return") si la
  // vuelta automática apunta a localhost.
  it('con la vuelta en localhost no pide auto_return', async () => {
    await crear({ FRONTEND_URL: 'http://localhost:3000' });
    assert.equal('auto_return' in cuerpo, false);
  });

  it('con una vuelta pública pide auto_return', async () => {
    await crear({ FRONTEND_URL: 'https://domus.app' });
    assert.equal(cuerpo.auto_return, 'approved');
  });
});
