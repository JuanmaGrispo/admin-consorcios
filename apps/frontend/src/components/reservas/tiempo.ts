/**
 * Fechas de las reservas. El backend recibe fecha y hora "de pared" del
 * edificio y devuelve instantes; acá se pasa de una cosa a la otra. Los
 * edificios son argentinos y Argentina no tiene horario de verano: -03:00 fijo.
 */
const OFFSET = '-03:00';
const ZONA = 'America/Argentina/Buenos_Aires';
const DIA_MS = 86_400_000;

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DIAS_CORTOS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "10:00:00" → "10:00". */
export const hhmm = (hora: string) => hora.slice(0, 5);

/** Hoy en el edificio, "AAAA-MM-DD". */
export function hoy(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: ZONA });
}

/** "AAAA-MM-DD" ± días. Al mediodía UTC: ningún corrimiento cambia el día. */
export function sumarDias(fecha: string, dias: number): string {
  return new Date(Date.parse(`${fecha}T12:00:00Z`) + dias * DIA_MS).toISOString().slice(0, 10);
}

/** 0 = domingo … 6 = sábado. */
export function diaDeLaSemana(fecha: string): number {
  return new Date(`${fecha}T12:00:00Z`).getUTCDay();
}

/** El lunes de la semana de `fecha`. */
export function lunesDe(fecha: string): string {
  return sumarDias(fecha, -((diaDeLaSemana(fecha) + 6) % 7));
}

/** El instante de una fecha y hora de pared del edificio. */
export function instante(fecha: string, hora: string): Date {
  return new Date(`${fecha}T${hhmm(hora)}:00${OFFSET}`);
}

/** Un instante → la fecha de pared del edificio, "AAAA-MM-DD". */
export function fechaDe(valor: string | Date): string {
  return new Date(valor).toLocaleDateString('en-CA', { timeZone: ZONA });
}

/** Un instante → "20:00". */
export function horaDe(valor: string | Date): string {
  return new Date(valor).toLocaleTimeString('es-AR', {
    timeZone: ZONA,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** "2026-09-13" → "13/09". */
export const diaMes = (fecha: string) => `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;

/** "2026-09-13" → "13/09/2026". */
export const fechaCorta = (fecha: string) => `${diaMes(fecha)}/${fecha.slice(0, 4)}`;

/** "2026-09-13" → "Domingo 13/09/2026". */
export const fechaLarga = (fecha: string) => `${mayuscula(DIAS[diaDeLaSemana(fecha)])} ${fechaCorta(fecha)}`;

/** "2026-09-13" → "DOM". */
export const diaCorto = (fecha: string) => DIAS_CORTOS[diaDeLaSemana(fecha)];

/** "2026-09-13" → "domingo". */
export const nombreDelDia = (fecha: string) => DIAS[diaDeLaSemana(fecha)];

/** "2026-09" → "Septiembre 2026". */
export function nombreDelMes(mes: string): string {
  return `${mayuscula(MESES[Number(mes.slice(5, 7)) - 1])} ${mes.slice(0, 4)}`;
}

/** Una reserva como la dice el prototipo: "Domingo 13/09/2026 · 20:00 a 02:00". */
export function cuando(inicio: string, fin: string): string {
  return `${fechaLarga(fechaDe(inicio))} · ${horaDe(inicio)} a ${horaDe(fin)}`;
}
