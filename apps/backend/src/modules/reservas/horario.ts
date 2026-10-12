export interface VentanaAmenity {
  horaApertura: string;
  horaCierre: string;
  duracionMaximaHoras: number | null;
  /** Turnos fijos desde la apertura ("franjas de 4 horas"). Null: horario libre. */
  duracionFranjaMinutos?: number | null;
}

export type ProblemaFranja = 'FUERA_DE_HORARIO' | 'DEMASIADO_LARGA' | 'FUERA_DE_FRANJA';

/** El horario de un día: de qué hora a qué hora abre. */
export interface HorasDelDia {
  horaApertura: string;
  horaCierre: string;
}

/**
 * Las excepciones al horario general por día de la semana ISO ("1" lunes …
 * "7" domingo), como se guardan en `amenity.horario_semanal`. Un día con
 * `null` está cerrado; uno que no figura usa el horario general.
 */
export type HorarioSemanal = Partial<Record<string, { apertura: string; cierre: string } | null>>;

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Lee y valida lo que viene en `horario_semanal` (de la base o del DTO).
 * Devuelve el error en castellano si algo no cierra, para que el alta lo
 * rechace con un 400 en vez de guardar un horario que nadie puede usar.
 */
export function leerHorarioSemanal(valor: unknown): { horario: HorarioSemanal | null; error?: string } {
  if (valor === null || valor === undefined) return { horario: null };
  if (typeof valor !== 'object' || Array.isArray(valor)) {
    return { horario: null, error: 'El horario por día tiene que ser un objeto por día de la semana' };
  }
  const horario: HorarioSemanal = {};
  for (const [dia, horas] of Object.entries(valor as Record<string, unknown>)) {
    if (!/^[1-7]$/.test(dia)) {
      return { horario: null, error: `"${dia}" no es un día de la semana (1 lunes … 7 domingo)` };
    }
    if (horas === null) {
      horario[dia] = null;
      continue;
    }
    const { apertura, cierre } = (horas ?? {}) as { apertura?: unknown; cierre?: unknown };
    if (typeof apertura !== 'string' || typeof cierre !== 'string' || !HORA.test(apertura) || !HORA.test(cierre)) {
      return { horario: null, error: 'Cada día lleva apertura y cierre en formato HH:MM, o null si está cerrado' };
    }
    horario[dia] = { apertura, cierre };
  }
  return { horario: Object.keys(horario).length ? horario : null };
}

/** Día de la semana ISO de una fecha "2026-09-12": 1 lunes … 7 domingo. */
export function diaDeLaSemana(fecha: string): number {
  const dia = new Date(`${fecha.slice(0, 10)}T12:00:00Z`).getUTCDay();
  return dia === 0 ? 7 : dia;
}

/** "2026-09-12" → "2026-09-11". */
export function diaAnterior(fecha: string): string {
  const d = new Date(`${fecha.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * El horario de ese día: el general, el del día si tiene uno propio, o null
 * si ese día está cerrado.
 */
export function horasDelDia(
  amenity: HorasDelDia & { horarioSemanal?: object | null },
  fecha: string,
): HorasDelDia | null {
  const { horario } = leerHorarioSemanal(amenity.horarioSemanal);
  const propio = horario?.[String(diaDeLaSemana(fecha))];
  if (propio === undefined) return { horaApertura: amenity.horaApertura, horaCierre: amenity.horaCierre };
  if (propio === null) return null;
  return { horaApertura: propio.apertura, horaCierre: propio.cierre };
}

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

/**
 * Si la franja entra en el horario. Sin `dias`, todos los días abren igual
 * (`ventana`); con `dias`, cada uno con el suyo: `hoy` es el del día de la
 * reserva y `ayer` el del anterior, cuya ventana puede seguir de madrugada.
 * Null en cualquiera de los dos es día cerrado.
 */
export function validarFranja(
  horaInicio: string,
  horaFin: string,
  ventana: VentanaAmenity,
  dias?: { hoy: HorasDelDia | null; ayer: HorasDelDia | null },
): ProblemaFranja | null {
  const { inicio, fin } = franjaEnMinutos(horaInicio, horaFin);
  const hoy = dias ? dias.hoy : ventana;
  const ayer = dias ? dias.ayer : ventana;

  // La franja tiene que caer en la ventana que abre ese día o en la que abrió
  // el día anterior: de 00:30 a 01:30 del sábado es la noche del viernes.
  // Abierto las 24 h, la ventana que cuenta es la que abrió antes del inicio
  // y la franja puede seguir en la del día siguiente.
  const candidatas = [
    hoy && { desde: minutosDeHora(hoy.horaApertura), largo: largoDeVentana(hoy.horaApertura, hoy.horaCierre) },
    ayer && {
      desde: minutosDeHora(ayer.horaApertura) - DIA,
      largo: largoDeVentana(ayer.horaApertura, ayer.horaCierre),
    },
  ].filter((c): c is { desde: number; largo: number } => !!c);
  const desde = candidatas.find(
    (c) => inicio >= c.desde && (c.largo === DIA ? inicio < c.desde + DIA : fin <= c.desde + c.largo),
  )?.desde;
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
