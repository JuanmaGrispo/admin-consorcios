/**
 * Único punto de contacto con el backend. Los services (src/services/) usan
 * esto; los componentes usan los services. Nadie más hace fetch.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status} en ${path}${body ? `: ${body}` : ''}`);
  }

  // 204 No Content no trae body.
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
