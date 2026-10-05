import { fechaLegible, instanteLegible, mesLegible } from '../../core/formato';
import type { EventoDomus } from '../../core/mensajeria/eventos';

/** Los eventos que terminan en el muro. El resto (un reclamo, un aviso personal) no es del edificio. */
export const EVENTOS_DEL_MURO = [
  'asamblea.creada',
  'votacion.nueva',
  'votacion.cerrada',
  'expensas.emitidas',
] as const;

const RESULTADOS: Record<string, string> = {
  aprobada: 'Se aprobó',
  rechazada: 'Se rechazó',
  sin_quorum: 'No alcanzó el quórum, así que no decide nada',
};

/** La columna `titulo` es varchar(150). */
const recortar = (titulo: string) => (titulo.length > 150 ? `${titulo.slice(0, 149)}…` : titulo);

/** La novedad que publica el muro por un evento, o `null` si el evento no va al muro. */
export function novedadDeEvento(evento: EventoDomus): { titulo: string; cuerpo: string } | null {
  switch (evento.tipo_evento) {
    case 'asamblea.creada': {
      const p = evento.payload;
      return {
        titulo: recortar(`Asamblea convocada: ${p.titulo}`),
        cuerpo: `Se convocó la asamblea "${p.titulo}" para el ${fechaLegible(p.fecha)} a las ${p.hora}${
          p.lugar ? ` en ${p.lugar}` : ''
        }. Confirmá tu asistencia desde el portal.`,
      };
    }
    case 'votacion.nueva': {
      const p = evento.payload;
      return {
        titulo: recortar(`Nueva votación: ${p.titulo}`),
        cuerpo: `Está abierta la votación "${p.titulo}" hasta el ${instanteLegible(p.fecha_cierre)}. Podés votar desde el portal.`,
      };
    }
    case 'votacion.cerrada': {
      const p = evento.payload;
      return {
        titulo: recortar(`Resultado de la votación: ${p.titulo}`),
        cuerpo: `${RESULTADOS[p.resultado] ?? p.resultado}. Participó el ${p.participacion_pct}% del padrón.`,
      };
    }
    case 'expensas.emitidas': {
      const p = evento.payload;
      return {
        titulo: `Expensas de ${mesLegible(p.periodo)}`,
        cuerpo: `Ya están emitidas las expensas de ${mesLegible(p.periodo)}. Vencen el ${fechaLegible(
          p.fecha_vencimiento,
        )}. Cada vecino ve su boleta en el portal.`,
      };
    }
    default:
      return null;
  }
}
