/**
 * Puente entre `<input type="datetime-local">` y el backend. El input trabaja
 * con "2026-11-12T19:00" sin zona; el backend recibe un instante con zona. Los
 * edificios son argentinos, así que la hora que escribe la gente es la de
 * Buenos Aires (UTC-3, sin horario de verano) aunque el navegador esté en otra.
 */
const OFFSET = '-03:00';

/** "2026-11-12T19:00" → "2026-11-12T19:00:00-03:00". */
export function localAInstante(local: string): string {
  return `${local}:00${OFFSET}`;
}

/** Un instante del backend → "2026-11-12T19:00", para precargar el input. */
export function instanteALocal(instante: string | Date): string {
  const buenosAires = new Date(new Date(instante).getTime() - 3 * 3600 * 1000);
  return buenosAires.toISOString().slice(0, 16);
}
