import { api, query } from '@/lib/api';
import type { BandejaDeNotificaciones } from '@/types/notificacion';

/** El centro de notificaciones propio, cualquiera sea el rol. */
export const notificacionesService = {
  listar: (filtros: { soloNoLeidas?: boolean; pagina?: number; limite?: number } = {}) =>
    api<BandejaDeNotificaciones>(`/notificaciones${query(filtros)}`),

  /** Sólo el número de la campana: una página de uno alcanza, lo que importa es `noLeidas`. */
  noLeidas: async () => (await notificacionesService.listar({ limite: 1 })).noLeidas,

  marcarLeida: (id: string) => api<void>(`/notificaciones/${id}/leida`, { method: 'PATCH' }),

  marcarTodas: () => api<void>('/notificaciones/leer-todas', { method: 'POST' }),
};
