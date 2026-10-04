const ZONA = 'America/Argentina/Buenos_Aires';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** `2026-10` → `octubre 2026`. */
export const mesLegible = (periodo: string) => {
  const [anio, mes] = periodo.split('-');
  return `${MESES[Number(mes) - 1]} ${anio}`;
};

/** `2026-11-10` → `10/11/2026`. */
export const fechaLegible = (fecha: string) => fecha.split('-').reverse().join('/');

/** Un instante ISO en hora de Buenos Aires. */
export const instanteLegible = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { timeZone: ZONA, dateStyle: 'short', timeStyle: 'short' });
