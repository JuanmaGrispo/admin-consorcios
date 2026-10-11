import { api } from '@/lib/api';
import type { Inicio } from '@/types/inicio';

/** GET /inicio: la pantalla de inicio del vecino en una sola llamada. */
export const inicioService = {
  obtener: () => api<Inicio>('/inicio'),
};
