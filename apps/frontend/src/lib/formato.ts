/**
 * Cómo se muestran los datos en toda la app: pesos, fechas, períodos y
 * porcentajes en formato argentino. Usar siempre esto, nunca `toFixed` ni
 * `toLocaleString` sueltos en un componente: así todas las pantallas dicen
 * "$ 145.320,50" y "10/09/2026" de la misma forma.
 */

/** Los edificios son argentinos: las horas se muestran en Buenos Aires aunque el navegador esté en otra zona. */
const ZONA = 'America/Argentina/Buenos_Aires';

const PESOS = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
});

const PESOS_REDONDOS = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** 145320.5 → "$ 145.320,50". Con `redondo`, sin centavos: para KPIs. */
export function pesos(monto: number, opciones: { redondo?: boolean } = {}): string {
  return (opciones.redondo ? PESOS_REDONDOS : PESOS).format(monto);
}

/** 54.3 → "54,3%". */
export function porcentaje(valor: number, decimales = 1): string {
  return `${valor.toLocaleString('es-AR', { maximumFractionDigits: decimales })}%`;
}

/**
 * Una fecha sin hora del backend (`2026-09-10`, columnas `date`) → "10/09/2026".
 * No pasa por `Date`: armar un Date de "2026-09-10" lo interpreta en UTC y en
 * Argentina mostraría el día anterior.
 */
export function fecha(valor: string): string {
  const [anio, mes, dia] = valor.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}

/** Un instante (ISO con hora, columnas `timestamptz`) → "04/09/2026". */
export function fechaDeInstante(valor: string | Date): string {
  return new Date(valor).toLocaleDateString('es-AR', {
    timeZone: ZONA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Un instante → "04/09/2026 14:38". */
export function fechaHora(valor: string | Date): string {
  const d = new Date(valor);
  return `${fechaDeInstante(d)} ${hora(d)}`;
}

/** Un instante → "14:38". */
export function hora(valor: string | Date): string {
  return new Date(valor).toLocaleTimeString('es-AR', {
    timeZone: ZONA,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** "2026-08" o "2026-08-01" → "Agosto 2026". */
export function periodo(valor: string): string {
  const [anio, mes] = valor.split('-');
  const nombre = MESES[Number(mes) - 1] ?? mes;
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${anio}`;
}

/** Un instante pasado → "hace 3 días", "hace 6 horas", "recién". */
export function haceCuanto(valor: string | Date, ahora = new Date()): string {
  const minutos = Math.floor((ahora.getTime() - new Date(valor).getTime()) / 60_000);
  if (minutos < 1) return 'recién';
  if (minutos < 60) return `hace ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

/** Iniciales para un avatar: "Julieta Sosa" → "JS". */
export function iniciales(nombre: string, apellido = ''): string {
  return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();
}

/** "Av. Rivadavia" + "4820" → "Av. Rivadavia 4820". */
export function domicilio(calle: string | null, numero: string | null): string {
  return [calle, numero].filter(Boolean).join(' ');
}
