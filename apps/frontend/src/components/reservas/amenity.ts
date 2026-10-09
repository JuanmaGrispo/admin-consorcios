import type { Amenity } from '@/types/reserva';
import { hhmm } from './tiempo';

/** "10:00 a 02:00". */
export const horario = (a: Amenity) => `${hhmm(a.horaApertura)} a ${hhmm(a.horaCierre)}`;

/**
 * La línea gris debajo del nombre (pantallas 05 y 14): "Cupo 30 · requiere
 * aprobación", "2 lugares · máx. 24 h". El vecino lo lee con otras palabras.
 */
export function resumenAmenity(a: Amenity, para: 'admin' | 'vecino'): string {
  const partes: string[] = [];
  if (a.lugares > 1) partes.push(`${a.lugares} lugares`);
  else if (a.cupoPersonas) partes.push(para === 'admin' ? `Cupo ${a.cupoPersonas}` : `Hasta ${a.cupoPersonas} personas`);
  if (a.lugares > 1 && a.duracionMaximaHoras) partes.push(`máx. ${a.duracionMaximaHoras} h`);
  else if (a.requiereAprobacion) partes.push('requiere aprobación');
  else partes.push(para === 'admin' ? 'aprobación automática' : 'confirmación inmediata');
  return partes.join(' · ');
}

/** "72 horas", "1 hora". */
export const horas = (n: number) => `${n} ${n === 1 ? 'hora' : 'horas'}`;
