import { api, query } from '@/lib/api';
import type { ResumenReclamos } from '@/types/reclamo';

/** Una función por endpoint de /reclamos. El módulo de reclamos completa el resto. */
export const reclamosService = {
  resumen: (consorcioId?: string) =>
    api<ResumenReclamos>(`/reclamos/resumen${query({ consorcioId })}`),
};
