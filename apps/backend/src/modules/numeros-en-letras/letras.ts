/**
 * Números en letras: el español que se imprime en boletas y recibos, y la
 * lectura de las palabras en inglés que devuelve el servicio SOAP
 * NumberConversion (que no tiene versión en español).
 */

const UNIDADES = [
  'cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve',
  'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete',
  'veintiocho', 'veintinueve',
];
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const CENTENAS = [
  '', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos',
  'seiscientos', 'setecientos', 'ochocientos', 'novecientos',
];

/** El mayor importe que se escribe: hasta los miles de millones alcanza para cualquier expensa. */
export const MAXIMO = 999_999_999_999;

/** 0 a 999. `apocopado`: "un"/"veintiún" delante de "mil" o "millones". */
function hastaMil(n: number, apocopado: boolean): string {
  if (n === 100) return 'cien';
  const centena = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (centena) partes.push(CENTENAS[centena]);
  if (resto) {
    let texto: string;
    if (resto < 30) texto = UNIDADES[resto];
    else {
      const unidad = resto % 10;
      texto = DECENAS[Math.floor(resto / 10)] + (unidad ? ` y ${UNIDADES[unidad]}` : '');
    }
    // "veintiuno mil" no se dice: "veintiún mil", "treinta y un mil".
    if (apocopado) texto = texto.replace(/uno$/, 'ún').replace(/ ún$/, ' un').replace(/^ún$/, 'un');
    partes.push(texto);
  }
  return partes.join(' ');
}

/** Un entero en letras, en minúscula: 145320 → "ciento cuarenta y cinco mil trescientos veinte". */
export function enteroEnLetras(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > MAXIMO) {
    throw new RangeError(`No se puede escribir en letras: ${n}`);
  }
  if (n === 0) return 'cero';

  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const partes: string[] = [];

  if (millones) {
    // Los millones se escriben como un número de hasta 6 cifras: "mil quinientos millones".
    partes.push(millones === 1 ? 'un millón' : `${milesEnLetras(millones, true)} millones`);
  }
  if (miles) partes.push(miles === 1 ? 'mil' : `${hastaMil(miles, true)} mil`);
  if (resto) partes.push(hastaMil(resto, false));
  return partes.join(' ');
}

/** 1 a 999.999, para la cantidad de millones. */
function milesEnLetras(n: number, apocopado: boolean): string {
  const miles = Math.floor(n / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (miles) partes.push(miles === 1 ? 'mil' : `${hastaMil(miles, true)} mil`);
  if (resto) partes.push(hastaMil(resto, apocopado));
  return partes.join(' ');
}

/**
 * Un importe como se escribe en un comprobante argentino:
 * 145320.5 → "SON PESOS CIENTO CUARENTA Y CINCO MIL TRESCIENTOS VEINTE CON 50/100".
 * `letras` permite pasar el entero ya escrito (el que vino del servicio).
 */
export function importeEnLetras(monto: number, letras?: string): string {
  const centavos = Math.round(Math.abs(monto) * 100);
  const entero = Math.floor(centavos / 100);
  const fraccion = String(centavos % 100).padStart(2, '0');
  return `SON PESOS ${(letras ?? enteroEnLetras(entero)).toUpperCase()} CON ${fraccion}/100`;
}

// ── Lectura del inglés del servicio ──────────────────────────────────────────

const INGLES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const ESCALAS: Record<string, number> = { thousand: 1_000, million: 1_000_000, billion: 1_000_000_000 };

/**
 * "one hundred and forty five thousand three hundred and twenty" → 145320.
 * Devuelve null si aparece una palabra que no es de un número: la respuesta
 * no se usa y se escribe localmente.
 */
export function leerIngles(palabras: string): number | null {
  const tokens = palabras.toLowerCase().replace(/-/g, ' ').split(/\s+/).filter((t) => t && t !== 'and');
  if (tokens.length === 0) return null;
  let total = 0;
  let grupo = 0;
  for (const t of tokens) {
    if (t in INGLES) grupo += INGLES[t];
    else if (t === 'hundred') grupo *= 100;
    else if (t in ESCALAS) {
      total += grupo * ESCALAS[t];
      grupo = 0;
    } else return null;
  }
  return total + grupo;
}
