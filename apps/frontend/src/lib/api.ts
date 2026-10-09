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
    message = Array.isArray(body.message) ? body.message.join('. ') : (body.message ?? message);
  } catch {
    /* body no-JSON: queda el genérico */
  }
  return new ApiError(res.status, message);
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    // La sesión vive en una cookie httpOnly: sin esto el navegador no la manda.
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  if (!res.ok) throw await errorDe(res);

  // 204 No Content no trae body.
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
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
