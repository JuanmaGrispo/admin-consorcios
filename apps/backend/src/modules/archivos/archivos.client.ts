import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TipoArchivo } from './tipos-archivo';
import { llamarProveedor } from '../../core/http/proveedor-rest';

/**
 * Única puerta a Supabase Storage. Con `fetch` de Node y la API REST: son dos
 * llamadas y no justifican sumar `@supabase/supabase-js` al bundle.
 *
 * Usa la service role key, así que **este cliente nunca se expone**: sube lo
 * que el service ya validó y nada más.
 */
@Injectable()
export class ArchivosClient {
  private readonly logger = new Logger(ArchivosClient.name);

  constructor(private readonly config: ConfigService) {}

  /** Sube el archivo y devuelve la URL pública con la que queda servido. */
  async subir(ruta: string, contenido: Buffer, tipo: TipoArchivo): Promise<string> {
    return llamarProveedor(async (signal) => {
    const base = this.exigir('SUPABASE_URL').replace(/\/$/, '');
    const bucket = this.bucket();

    const respuesta = await fetch(
      `${base}/storage/v1/object/${bucket}/${this.codificar(ruta)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.exigir('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': tipo,
          // Sin sobrescritura: la ruta lleva un uuid, así que una colisión
          // sería un bug nuestro y preferimos que haga ruido.
          'x-upsert': 'false',
        },
        body: new Uint8Array(contenido),
        signal,
      },
    );

    if (!respuesta.ok) {
      this.logger.error(`subir ${ruta} → ${respuesta.status}`);
      throw new BadGatewayException('No se pudo guardar el archivo. Probá de nuevo en un rato.');
    }

    return `${this.basePublica()}/storage/v1/object/public/${bucket}/${this.codificar(ruta)}`;
    });
  }

  /** Borra un archivo. Que no exista no es un error: el resultado es el mismo. */
  async borrar(ruta: string): Promise<void> {
    return llamarProveedor(async (signal) => {
    const base = this.exigir('SUPABASE_URL').replace(/\/$/, '');
    const respuesta = await fetch(
      `${base}/storage/v1/object/${this.bucket()}/${this.codificar(ruta)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.exigir('SUPABASE_SERVICE_ROLE_KEY')}` },
        signal,
      },
    );
    if (!respuesta.ok && respuesta.status !== 404) {
      this.logger.error(`borrar ${ruta} → ${respuesta.status}`);
      throw new BadGatewayException('No se pudo borrar el archivo');
    }
    });
  }

  /**
   * La ruta a la que apunta una URL pública nuestra, o `null` si la URL no es
   * de este bucket. Sirve para no dejar borrar por path arbitrario.
   */
  rutaDeUrl(url: string): string | null {
    const prefijo = `${this.basePublica()}/storage/v1/object/public/${this.bucket()}/`;
    if (!url.startsWith(prefijo)) return null;
    try {
      const ruta = decodeURIComponent(url.slice(prefijo.length));
      if (/[\\\x00]/.test(ruta) || ruta.split('/').some((s) => !s || s === '.' || s === '..')) return null;
      return ruta;
    } catch {
      return null;
    }
  }

  private bucket(): string {
    return this.config.get<string>('SUPABASE_STORAGE_BUCKET', 'domus');
  }

  private basePublica(): string {
    return (this.config.get<string>('SUPABASE_PUBLIC_URL')?.trim() || this.exigir('SUPABASE_URL')).replace(/\/$/, '');
  }

  /** Cada segmento por separado: las barras de la ruta tienen que sobrevivir. */
  private codificar(ruta: string): string {
    return ruta.split('/').map(encodeURIComponent).join('/');
  }

  private exigir(variable: string): string {
    const valor = this.config.get<string>(variable);
    if (!valor) throw new ServiceUnavailableException('La subida de archivos no está configurada');
    return valor;
  }
}
