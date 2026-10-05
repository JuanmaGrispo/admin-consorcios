import type { Asamblea } from '../../database/entities';
import type { PayloadsEventos } from '../../core/mensajeria/eventos';

const ZONA = 'America/Argentina/Buenos_Aires';

/** El payload de `asamblea.creada` y `asamblea.recordatorio`: fecha y hora de pared en Buenos Aires. */
export function datosDeAsamblea(asamblea: Asamblea): PayloadsEventos['asamblea.creada'] {
  return {
    asamblea_id: asamblea.id,
    titulo: asamblea.titulo,
    fecha: asamblea.fechaHora.toLocaleDateString('en-CA', { timeZone: ZONA }),
    hora: asamblea.fechaHora.toLocaleTimeString('es-AR', {
      timeZone: ZONA,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
    lugar: asamblea.lugar ?? asamblea.linkVideollamada ?? null,
  };
}
