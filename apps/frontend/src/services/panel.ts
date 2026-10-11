import { api, query } from '@/lib/api';
import type { Panel } from '@/types/panel';

/** GET /panel: el panel general del administrador. */
export const panelService = {
  /** Sin período, el último que emitió alguno de sus consorcios. */
  obtener: (periodo?: string) => api<Panel>(`/panel${query({ periodo })}`),
};
