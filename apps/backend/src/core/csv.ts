/**
 * CSV para abrir en Excel en español: `;` de separador, coma decimal y BOM.
 * Así Excel lo abre en columnas de una, sin pasar por el asistente de
 * importación. Es CSV y no .xlsx a propósito: un xlsx real pide una
 * dependencia nueva y Excel abre este archivo igual.
 */

/**
 * Excel ejecuta como fórmula un texto que empieza con =, +, - o @ (o con un
 * tab/retorno). El nombre de un vecino lo escribe el vecino: se le antepone
 * una comilla simple para que se lea como texto. Los importes (que pueden ser
 * negativos) son números y se dejan como están.
 */
const neutralizarFormula = (texto: string) =>
  /^[=+\-@\t\r]/.test(texto) && !/^-?\d+(,\d+)?$/.test(texto) ? `'${texto}` : texto;

/**
 * Una celda de CSV. Se entrecomilla siempre: los nombres traen comas y los
 * importes, la coma decimal de es-AR. Las comillas internas se duplican, que
 * es como las escapa el formato.
 */
export const celda = (valor: string | number | null | undefined) =>
  `"${neutralizarFormula(String(valor ?? '')).replace(/"/g, '""')}"`;

/** Importe con coma decimal, para que Excel en es-AR lo lea como número. */
export const importe = (n: number) => n.toFixed(2).replace('.', ',');

/** Una línea del archivo: las celdas ya escapadas y separadas por `;`. */
export const linea = (valores: (string | number | null | undefined)[]) => valores.map(celda).join(';');

/**
 * El archivo entero: BOM y fin de línea de Windows, que es lo que espera Excel.
 * Recibe líneas ya armadas con `linea()`; una línea vacía separa bloques.
 */
export const archivoCsv = (lineas: string[]) => `\uFEFF${lineas.join('\r\n')}\r\n`;
