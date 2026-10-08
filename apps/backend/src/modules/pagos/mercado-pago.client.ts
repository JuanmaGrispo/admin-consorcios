import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

const API = 'https://api.mercadopago.com';

export interface PreferenciaCreada {
  id: string;
  initPoint: string;
}

/** Lo que usamos de un pago de Mercado Pago. */
export interface PagoMercadoPago {
  id: number;
  status: string;
  status_detail: string | null;
  external_reference: string | null;
  transaction_amount: number;
  date_approved: string | null;
}

/**
 * Verifica la cabecera `x-signature` de un webhook ("ts=...,v1=...").
 * Mercado Pago firma con HMAC-SHA256 el manifest
 * `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` usando la clave secreta
 * del webhook. El id va en minúsculas si es alfanumérico.
 */
export function firmaValida(
  secreto: string,
  firma: string | undefined,
  requestId: string | undefined,
  dataId: string,
): boolean {
  if (!firma || !requestId) return false;
  const partes = new Map(
    firma.split(',').map((p) => p.split('=', 2).map((s) => s.trim()) as [string, string]),
  );
  const ts = partes.get('ts');
  const v1 = partes.get('v1');
  if (!ts || !v1) return false;

  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const esperada = createHmac('sha256', secreto).update(manifest).digest();
  const recibida = Buffer.from(v1, 'hex');
  return recibida.length === esperada.length && timingSafeEqual(recibida, esperada);
}

/**
 * Única puerta a la API de Mercado Pago. Con `fetch` de Node: son dos
 * llamadas sueltas y no justifican el SDK.
 */
@Injectable()
export class MercadoPagoClient {
  private readonly logger = new Logger(MercadoPagoClient.name);

  constructor(private readonly config: ConfigService) {}

  async crearPreferencia(datos: {
    titulo: string;
    monto: number;
    /** Nuestro id de pago: vuelve en el webhook como `external_reference`. */
    referencia: string;
  }): Promise<PreferenciaCreada> {
    const frontend = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const vuelta = `${frontend}${this.config.get<string>('MP_RETURN_PATH', '/expensas/pago')}`;
    const respuesta = await this.llamar<{ id: string; init_point: string }>(
      'POST',
      '/checkout/preferences',
      {
        items: [{ title: datos.titulo, quantity: 1, unit_price: datos.monto, currency_id: 'ARS' }],
        external_reference: datos.referencia,
        notification_url: this.config.get<string>('MP_NOTIFICATION_URL'),
        back_urls: {
          success: `${vuelta}?pago=aprobado`,
          pending: `${vuelta}?pago=pendiente`,
          failure: `${vuelta}?pago=rechazado`,
        },
        auto_return: 'approved',
      },
    );
    return { id: respuesta.id, initPoint: respuesta.init_point };
  }

  /** Una preferencia ya creada: para volver a mandar al vecino al mismo checkout. */
  async obtenerPreferencia(id: string): Promise<PreferenciaCreada> {
    const respuesta = await this.llamar<{ id: string; init_point: string }>(
      'GET',
      `/checkout/preferences/${encodeURIComponent(id)}`,
    );
    return { id: respuesta.id, initPoint: respuesta.init_point };
  }

  obtenerPago(id: string): Promise<PagoMercadoPago> {
    return this.llamar('GET', `/v1/payments/${encodeURIComponent(id)}`);
  }

  /**
   * El intento más reciente de un pago nuestro, buscado por `external_reference`.
   * Es lo que permite confirmar un pago aunque el webhook no haya llegado.
   */
  async ultimoIntento(referencia: string): Promise<PagoMercadoPago | null> {
    const { results } = await this.llamar<{ results: PagoMercadoPago[] }>(
      'GET',
      `/v1/payments/search?external_reference=${encodeURIComponent(referencia)}&sort=date_created&criteria=desc`,
    );
    return results[0] ?? null;
  }

  firmaValida(firma: string | undefined, requestId: string | undefined, dataId: string): boolean {
    return firmaValida(this.exigir('MP_WEBHOOK_SECRET'), firma, requestId, dataId);
  }

  private async llamar<T>(metodo: 'GET' | 'POST', ruta: string, cuerpo?: unknown): Promise<T> {
    const respuesta = await fetch(`${API}${ruta}`, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${this.exigir('MP_ACCESS_TOKEN')}`,
        'Content-Type': 'application/json',
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(10_000),
    });
    if (!respuesta.ok) {
      this.logger.error(`${metodo} ${ruta} → ${respuesta.status}: ${await respuesta.text()}`);
      throw new BadGatewayException('Mercado Pago no respondió bien. Probá de nuevo en un rato.');
    }
    return (await respuesta.json()) as T;
  }

  private exigir(variable: string): string {
    const valor = this.config.get<string>(variable);
    if (!valor) throw new ServiceUnavailableException('Mercado Pago no está configurado');
    return valor;
  }
}
