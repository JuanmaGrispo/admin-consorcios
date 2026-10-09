import { api, query } from '@/lib/api';
import type { Unidad } from '@/types/unidad';

/** Una función por endpoint de /unidades. El módulo que administre unidades completa el resto. */
export const unidadesService = {
  listar: (filtros: { consorcioId?: string; incluirInactivas?: boolean } = {}) =>
    api<Unidad[]>(`/unidades${query(filtros)}`),
};
