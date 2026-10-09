import { CategoriaNotificacion } from '../../database/entities';
import type { EventoDomus } from '../mensajeria/eventos';

/** Del prefijo del `origen` de un aviso directo a la categoría que elige el vecino. */
const POR_ORIGEN: Record<string, CategoriaNotificacion> = {
  boleta: CategoriaNotificacion.VENCIMIENTOS,
  pago: CategoriaNotificacion.BOLETAS,
  reclamo: CategoriaNotificacion.RECLAMOS_RESERVAS,
  reserva: CategoriaNotificacion.RECLAMOS_RESERVAS,
  votacion: CategoriaNotificacion.COMUNICADOS,
};

/**
 * En qué categoría de preferencias cae un evento, para respetar lo que el
 * vecino apagó en su perfil. `null` es un aviso que sale siempre: un aviso
 * operativo al administrador (un cobro duplicado) no se puede silenciar.
 */
export function categoriaDe(evento: EventoDomus): CategoriaNotificacion | null {
  switch (evento.tipo_evento) {
    case 'expensas.emitidas':
      return CategoriaNotificacion.BOLETAS;
    case 'reclamo.cerrado':
      return CategoriaNotificacion.RECLAMOS_RESERVAS;
    case 'aviso.directo':
      return POR_ORIGEN[evento.payload.origen.split(':')[0]] ?? null;
    default:
      return CategoriaNotificacion.COMUNICADOS;
  }
}
