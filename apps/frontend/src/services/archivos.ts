import { api, query } from '@/lib/api';

/**
 * DELETE /archivos. La subida está en `subirArchivo()` de lib/api.ts porque
 * es multipart; acá queda el borrado de lo que se descartó antes de enviar.
 */
export const archivosService = {
  borrar: (url: string) => api<void>(`/archivos${query({ url })}`, { method: 'DELETE' }),
};
