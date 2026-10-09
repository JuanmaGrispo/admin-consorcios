import { api, query } from '@/lib/api';
import type { RubroGasto, RubroGastoInput } from '@/types/catalogo';

/** Una función por endpoint de /rubros-gasto. */
export const rubrosGastoService = {
  /** Con `consorcioId`, los de ese consorcio más los compartidos. */
  listar: (consorcioId?: string) => api<RubroGasto[]>(`/rubros-gasto${query({ consorcioId })}`),

  crear: (input: RubroGastoInput) =>
    api<RubroGasto>('/rubros-gasto', { method: 'POST', body: JSON.stringify(input) }),

  /** Cambiar la naturaleza no toca los gastos ya cargados. */
  actualizar: (id: string, input: Omit<Partial<RubroGastoInput>, 'consorcioId'>) =>
    api<RubroGasto>(`/rubros-gasto/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),

  /** 409 si algún gasto lo usa. */
  borrar: (id: string) => api<void>(`/rubros-gasto/${id}`, { method: 'DELETE' }),
};
