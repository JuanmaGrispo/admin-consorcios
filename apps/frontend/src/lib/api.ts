/**
 * Único punto de contacto con el backend. Los services (src/services/) usan
 * esto; los componentes usan los services. Nadie más hace fetch.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** El backend manda { message } en los errores (a veces un array); si no, el genérico. */
async function errorDe(res: Response): Promise<ApiError> {
  let message = `Error ${res.status}`;
  try {
    const body = await res.json();
    message = Array.isArray(body.message) ? body.message.join('. ') : (body.detail ?? body.message ?? message);
  } catch {
    /* body no-JSON: queda el genérico */
  }
  return new ApiError(res.status, message);
}

export async function apiVersionada<T>(path: string, init?: RequestInit): Promise<{ datos: T; etag: string | null }> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    // La sesión vive en una cookie httpOnly: sin esto el navegador no la manda.
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  if (!res.ok) throw await errorDe(res);

  // 204 No Content no trae body.
  if (res.status === 204) return { datos: undefined as T, etag: res.headers.get('ETag') };
  return { datos: (await res.json()) as T, etag: res.headers.get('ETag') };
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  return (await apiVersionada<T>(path, init)).datos;
}

/**
 * Un POST que responde con Server-Sent Events: llama a `onEvento` con cada
 * evento a medida que llega. Va por fetch y no por EventSource porque
 * EventSource sólo hace GET y no manda body. Un error antes de empezar llega
 * como un error HTTP común (ApiError).
 */
export async function eventos(
  path: string,
  body: unknown,
  onEvento: (evento: string, datos: unknown) => void,
): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) throw await errorDe(res);

  const lector = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let pendiente = '';
  let terminado = false;
  try {
    for (;;) {
      const { value, done } = await lector.read();
      terminado = done;
      if (done) break;
      pendiente += value;
      // Cada evento termina en una línea vacía; el último puede estar a medias.
      const bloques = pendiente.split('\n\n');
      pendiente = bloques.pop() ?? '';
      for (const bloque of bloques) {
        const evento = /^event: (.*)$/m.exec(bloque)?.[1] ?? 'message';
        const datos = /^data: (.*)$/m.exec(bloque)?.[1];
        if (datos !== undefined) onEvento(evento, JSON.parse(datos));
      }
    }
  } finally {
    // Si `onEvento` tiró, se corta la conexión en vez de dejarla abierta.
    if (!terminado) await lector.cancel().catch(() => undefined);
  }
}

/**
 * Arma el query string sin los valores vacíos: `{ estado: undefined, pagina: 2 }`
 * → `?pagina=2`. Para los filtros de los listados.
 */
export function query(params: Record<string, string | number | boolean | null | undefined>): string {
  const qs = new URLSearchParams();
  for (const [clave, valor] of Object.entries(params)) {
    if (valor !== undefined && valor !== null && valor !== '') qs.set(clave, String(valor));
  }
  const texto = qs.toString();
  return texto ? `?${texto}` : '';
}

/**
 * Baja un archivo que genera el backend (boleta o recibo en PDF, cobranzas en
 * CSV) y lo ofrece para guardar. Va por fetch y no por un `<a href>` porque la
 * cookie de sesión tiene que viajar con `credentials: 'include'`.
 */
export async function descargar(path: string, nombreSugerido: string): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, { credentials: 'include' });
  if (!res.ok) throw await errorDe(res);

  // El backend sugiere el nombre en Content-Disposition; si no, el nuestro.
  const disposicion = res.headers.get('Content-Disposition') ?? '';
  const nombre = /filename="?([^";]+)"?/.exec(disposicion)?.[1] ?? nombreSugerido;

  const url = URL.createObjectURL(await res.blob());
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}

/** Dónde se guarda un archivo: cada columna `*_url` del backend tiene el suyo. */
export type DestinoArchivo =
  | 'reclamos'
  | 'comprobantes'
  | 'novedades'
  | 'votaciones'
  | 'actas'
  | 'avatares';

export interface ArchivoSubido {
  url: string;
  ruta: string;
  tipo: string;
  tamanio: number;
}

/**
 * Sube un archivo a `POST /archivos` y devuelve su URL, que es lo que después
 * se manda en el alta (foto de un reclamo, comprobante de un gasto, etc.).
 * No usa `api()`: el multipart arma su propio Content-Type con el boundary.
 */
export async function subirArchivo(archivo: File, destino: DestinoArchivo): Promise<ArchivoSubido> {
  const datos = new FormData();
  datos.append('archivo', archivo);
  const res = await fetch(`${API_URL}/archivos?destino=${destino}`, {
    method: 'POST',
    credentials: 'include',
    body: datos,
  });
  if (!res.ok) throw await errorDe(res);
  return (await res.json()) as ArchivoSubido;
}
