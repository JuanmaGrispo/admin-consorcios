import { api, query } from '@/lib/api';
import type { CategoriaReclamo, CategoriaReclamoInput } from '@/types/catalogo';

/** Una función por endpoint de /categorias-reclamo. */
export const categoriasReclamoService = {
  /** Con `consorcioId`, las de ese consorcio más las compartidas. */
  listar: (consorcioId?: string) =>
    api<CategoriaReclamo[]>(`/categorias-reclamo${query({ consorcioId })}`),

  crear: (input: CategoriaReclamoInput) =>
    api<CategoriaReclamo>('/categorias-reclamo', { method: 'POST', body: JSON.stringify(input) }),

  /** El alcance (consorcio o compartida) no se cambia. */
  actualizar: (id: string, input: Omit<Partial<CategoriaReclamoInput>, 'consorcioId'>) =>
    api<CategoriaReclamo>(`/categorias-reclamo/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  /** 409 si algún reclamo la usa. */
  borrar: (id: string) => api<void>(`/categorias-reclamo/${id}`, { method: 'DELETE' }),
};
