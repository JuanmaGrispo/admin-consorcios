import { Logger } from '@nestjs/common';

/**
 * Base para clientes de APIs externas. Cada API de afuera tiene UNA clase acá
 * adentro que la envuelve: el resto del backend nunca hace fetch directo ni
 * conoce las URLs de terceros.
 *
 * Un client concreto extiende esta clase, define su baseUrl desde config, y
 * expone métodos con tipos propios (los de NUESTRO dominio, no los del payload
 * ajeno). Ejemplo:
 *
 *   @Injectable()
 *   export class GeorefClient extends HttpClientBase {
 *     constructor(config: ConfigService) {
 *       super('GeorefClient', config.get('GEOREF_API_URL', 'https://apis.datos.gob.ar/georef/api'));
 *     }
 *     buscarDirecciones(q: string) {
 *       return this.get<{ direcciones: unknown[] }>(`/direcciones?direccion=${encodeURIComponent(q)}`);
 *     }
 *   }
 */
export abstract class HttpClientBase {
  protected readonly logger: Logger;

  protected constructor(
    name: string,
    protected readonly baseUrl: string,
  ) {
    this.logger = new Logger(name);
  }

  protected async get<T>(path: string, init?: RequestInit): Promise<T> {
    return this.request<T>(path, { ...init, method: 'GET' });
  }

  protected async post<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
    return this.request<T>(path, {
      ...init,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...init?.headers },
      body: JSON.stringify(body),
    });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, init);
    if (!res.ok) {
      this.logger.warn(`${init.method} ${url} → ${res.status}`);
      throw new Error(`External API error: ${init.method} ${url} → ${res.status}`);
    }
    return (await res.json()) as T;
  }
}
