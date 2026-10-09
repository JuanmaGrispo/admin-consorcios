import type { Paginado } from './comun';

export type TipoNotificacion = 'BOLETA' | 'VENCIMIENTO' | 'RECLAMO' | 'RESERVA' | 'ASAMBLEA' | 'NOVEDAD';

/** Un aviso del centro de notificaciones (tabla `notificacion`). */
export interface Notificacion {
  id: string;
  usuarioId: string;
  titulo: string;
  cuerpo: string | null;
  tipo: TipoNotificacion;
  /** A qué pantalla lleva: `reclamo`, `boleta`, `reserva`, `asamblea`, `votacion`, `liquidacion`… */
  entidadTipo: string | null;
  entidadId: string | null;
  leidaAt: string | null;
  createdAt: string;
}

/** GET /notificaciones: la página pedida y cuántas quedan sin leer (el número de la campana). */
export interface BandejaDeNotificaciones extends Paginado<Notificacion> {
  noLeidas: number;
}
