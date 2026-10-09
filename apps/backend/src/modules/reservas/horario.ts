export interface VentanaAmenity {
  horaApertura: string;
  horaCierre: string;
  duracionMaximaHoras: number | null;
}

export type ProblemaFranja = 'FUERA_DE_HORARIO' | 'DEMASIADO_LARGA';

export const ZONA_POR_DEFECTO = 'America/Argentina/Buenos_Aires';

const DIA = 24 * 60;

export function minutosDeHora(hora: string): number {
  const [h, m] = hora.split(':');
  return Number(h) * 60 + Number(m);
}

/**
 * Cuántos minutos está abierto el amenity desde que abre. Un cierre igual o
 * anterior a la apertura es del día siguiente (el SUM de 10:00 a 02:00), y
 * abrir y cerrar a la misma hora es estar abierto las 24 h.
 */
export function largoDeVentana(horaApertura: string, horaCierre: string): number {
  const apertura = minutosDeHora(horaApertura);
  const cierre = minutosDeHora(horaCierre);
  return cierre > apertura ? cierre - apertura : cierre + DIA - apertura;
}

export function cierraAlDiaSiguiente(horaApertura: string, horaCierre: string): boolean {
  return minutosDeHora(horaCierre) <= minutosDeHora(horaApertura);
}

/**
 * La franja en minutos desde las 00:00 del día en que empieza. Un fin igual o
 * anterior al inicio es del día siguiente: de 20:00 a 02:00 son seis horas, y
 * de 13:00 a 13:00, veinticuatro.
 */
export function franjaEnMinutos(horaInicio: string, horaFin: string): { inicio: number; fin: number } {
  const inicio = minutosDeHora(horaInicio);
  const fin = minutosDeHora(horaFin);
  return { inicio, fin: fin > inicio ? fin : fin + DIA };
}

export function validarFranja(
  horaInicio: string,
  horaFin: string,
  ventana: VentanaAmenity,
): ProblemaFranja | null {
  const { inicio, fin } = franjaEnMinutos(horaInicio, horaFin);
  const largo = largoDeVentana(ventana.horaApertura, ventana.horaCierre);
  const apertura = minutosDeHora(ventana.horaApertura);

  // La franja tiene que caer en la ventana que abre ese día o en la que abrió
  // el día anterior: de 00:30 a 01:30 del sábado es la noche del viernes.
  const dentro =
    largo === DIA ||
    [apertura, apertura - DIA].some((desde) => inicio >= desde && fin <= desde + largo);
  if (!dentro) return 'FUERA_DE_HORARIO';

  if (
    ventana.duracionMaximaHoras !== null &&
    fin - inicio > ventana.duracionMaximaHoras * 60
  ) {
    return 'DEMASIADO_LARGA';
  }

  return null;
}

/**
 * Hasta cuándo el vecino puede cancelar una reserva que empieza en `inicio`.
 * Con 0 horas, hasta que empieza.
 */
export function cancelableHasta(inicio: Date, horasDeAnticipacion: number): Date {
  return new Date(inicio.getTime() - horasDeAnticipacion * 3_600_000);
}

export type EstadoDelDia = 'DISPONIBLE' | 'PARCIAL' | 'SIN_LUGAR' | 'PASADO';

/**
 * Cómo está un día del calendario: cuánto de la ventana del amenity tapan las
 * reservas que ocupan y los bloqueos. Los intervalos se recortan a la ventana
 * y se unen antes de medir, porque una reserva y un bloqueo pueden solaparse.
 */
export function estadoDelDia(
  ventana: { inicio: Date; fin: Date },
  ocupado: { inicio: Date; fin: Date }[],
  ahora: Date,
): EstadoDelDia {
  if (ventana.fin <= ahora) return 'PASADO';

  const desde = Math.max(ventana.inicio.getTime(), ahora.getTime());
  const hasta = ventana.fin.getTime();
  const tramos = ocupado
    .map((o) => [Math.max(o.inicio.getTime(), desde), Math.min(o.fin.getTime(), hasta)])
    .filter(([i, f]) => f > i)
    .sort((a, b) => a[0] - b[0]);

  let cubierto = 0;
  let cursor = desde;
  for (const [i, f] of tramos) {
    if (f <= cursor) continue;
    cubierto += f - Math.max(i, cursor);
    cursor = f;
  }

  if (cubierto === 0) return 'DISPONIBLE';
  return cubierto >= hasta - desde ? 'SIN_LUGAR' : 'PARCIAL';
}
