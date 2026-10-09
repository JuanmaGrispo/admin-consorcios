export interface VentanaAmenity {
  horaApertura: string;
  horaCierre: string;
  duracionMaximaHoras: number | null;
  /** Turnos fijos desde la apertura ("franjas de 4 horas"). Null: horario libre. */
  duracionFranjaMinutos?: number | null;
}

export type ProblemaFranja = 'FUERA_DE_HORARIO' | 'DEMASIADO_LARGA' | 'FUERA_DE_FRANJA';

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
  // Abierto las 24 h, la ventana que cuenta es la que abrió antes del inicio.
  const desde =
    largo === DIA
      ? apertura + DIA * Math.floor((inicio - apertura) / DIA)
      : [apertura, apertura - DIA].find((d) => inicio >= d && fin <= d + largo);
  if (desde === undefined) return 'FUERA_DE_HORARIO';

  // Con turnos fijos, la reserva arranca en el borde de una franja y ocupa
  // franjas enteras: de 14 a 18 sí, de 15 a 17 no.
  const franja = ventana.duracionFranjaMinutos;
  if (franja && ((inicio - desde) % franja !== 0 || (fin - inicio) % franja !== 0)) {
    return 'FUERA_DE_FRANJA';
  }

  if (
    ventana.duracionMaximaHoras !== null &&
    fin - inicio > ventana.duracionMaximaHoras * 60
  ) {
    return 'DEMASIADO_LARGA';
  }

  return null;
}

/** 1500 → "01:00": minutos desde las 00:00, dando la vuelta al día. */
export function horaDeMinutos(minutos: number): string {
  const m = ((minutos % DIA) + DIA) % DIA;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/**
 * Las franjas enteras que caben en la ventana, con su hora de pared y su
 * desplazamiento desde la apertura. Un resto que no llega a una franja no se
 * ofrece: no se puede reservar media franja.
 */
export function franjasDeLaVentana(
  horaApertura: string,
  horaCierre: string,
  duracionFranjaMinutos: number,
): { horaInicio: string; horaFin: string; desdeApertura: number }[] {
  const apertura = minutosDeHora(horaApertura);
  const cantidad = Math.floor(largoDeVentana(horaApertura, horaCierre) / duracionFranjaMinutos);
  return Array.from({ length: cantidad }, (_, i) => {
    const desdeApertura = i * duracionFranjaMinutos;
    return {
      horaInicio: horaDeMinutos(apertura + desdeApertura),
      horaFin: horaDeMinutos(apertura + desdeApertura + duracionFranjaMinutos),
      desdeApertura,
    };
  });
}

export type EstadoDeFranja = 'LIBRE' | 'OCUPADA' | 'BLOQUEADA' | 'PASADA';

/**
 * Cada franja del día como instantes y con su estado. Una franja está ocupada
 * cuando todos los lugares del amenity tienen una reserva que la pisa; si
 * queda alguno, sigue libre y dice cuántos.
 */
export function estadoDeLasFranjas(
  franjas: { horaInicio: string; horaFin: string; desdeApertura: number }[],
  aperturaDelDia: Date,
  duracionFranjaMinutos: number,
  ctx: {
    reservas: { inicio: Date; fin: Date; lugar: number }[];
    bloqueos: { desde: Date; hasta: Date }[];
    lugares: number;
    ahora: Date;
  },
) {
  return franjas.map((f) => {
    const inicio = new Date(aperturaDelDia.getTime() + f.desdeApertura * 60_000);
    const fin = new Date(inicio.getTime() + duracionFranjaMinutos * 60_000);
    const pisan = <T>(desde: (x: T) => Date, hasta: (x: T) => Date) => (x: T) =>
      desde(x) < fin && hasta(x) > inicio;
    const tomados = new Set(
      ctx.reservas.filter(pisan((r) => r.inicio, (r) => r.fin)).map((r) => r.lugar),
    ).size;
    const lugaresLibres = Math.max(0, ctx.lugares - tomados);
    const estado: EstadoDeFranja =
      inicio <= ctx.ahora
        ? 'PASADA'
        : ctx.bloqueos.some(pisan((b) => b.desde, (b) => b.hasta))
          ? 'BLOQUEADA'
          : lugaresLibres === 0
            ? 'OCUPADA'
            : 'LIBRE';
    return { horaInicio: f.horaInicio, horaFin: f.horaFin, inicio, fin, estado, lugaresLibres };
  });
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
  ocupado: Intervalo[],
  ahora: Date,
  /** Los tramos sin ningún lugar libre. Con un solo lugar, es lo mismo que `ocupado`. */
  lleno: Intervalo[] = ocupado,
): EstadoDelDia {
  if (ventana.fin <= ahora) return 'PASADO';

  const desde = Math.max(ventana.inicio.getTime(), ahora.getTime());
  const hasta = ventana.fin.getTime();
  if (cubierto(ocupado, desde, hasta) === 0) return 'DISPONIBLE';
  return cubierto(lleno, desde, hasta) >= hasta - desde ? 'SIN_LUGAR' : 'PARCIAL';
}

interface Intervalo {
  inicio: Date;
  fin: Date;
}

/** Cuánto de [desde, hasta) tapan los intervalos, unidos antes de medir. */
function cubierto(intervalos: Intervalo[], desde: number, hasta: number): number {
  const tramos = intervalos
    .map((o) => [Math.max(o.inicio.getTime(), desde), Math.min(o.fin.getTime(), hasta)])
    .filter(([i, f]) => f > i)
    .sort((a, b) => a[0] - b[0]);

  let total = 0;
  let cursor = desde;
  for (const [i, f] of tramos) {
    if (f <= cursor) continue;
    total += f - Math.max(i, cursor);
    cursor = f;
  }
  return total;
}

/**
 * Los tramos en que hay `lugares` reservas a la vez, o sea, ningún lugar libre.
 * La base no deja dos reservas en el mismo lugar a la vez, así que contar
 * reservas simultáneas es contar lugares tomados.
 */
export function tramosLlenos(reservas: Intervalo[], lugares: number): Intervalo[] {
  const eventos = reservas
    .flatMap((r) => [
      { t: r.inicio.getTime(), d: 1 },
      { t: r.fin.getTime(), d: -1 },
    ])
    // A la misma hora, primero salen y después entran: [inicio, fin) no se pisan.
    .sort((a, b) => a.t - b.t || a.d - b.d);

  const llenos: Intervalo[] = [];
  let simultaneas = 0;
  let desde: number | null = null;
  for (const { t, d } of eventos) {
    simultaneas += d;
    if (simultaneas >= lugares && desde === null) desde = t;
    if (simultaneas < lugares && desde !== null) {
      if (t > desde) llenos.push({ inicio: new Date(desde), fin: new Date(t) });
      desde = null;
    }
  }
  return llenos;
}

/** El primer lugar (1..lugares) que no está tomado, o null si están todos. */
export function elegirLugar(tomados: number[], lugares: number): number | null {
  for (let lugar = 1; lugar <= lugares; lugar++) {
    if (!tomados.includes(lugar)) return lugar;
  }
  return null;
}
