/**
 * Un CSV armado en el navegador, con el mismo formato que los que genera el
 * backend (`expensas/cobranzas.ts`): `;` de separador, coma decimal y BOM, así
 * Excel en español lo abre en columnas de una. Para cuando los datos ya están
 * en pantalla y no vale la pena un endpoint.
 */

/** Se entrecomilla siempre: los nombres traen comas. Las comillas internas se duplican. */
const celda = (valor: string | number) => `"${String(valor).replace(/"/g, '""')}"`;

/** 1234.5 → "1234,50", que Excel en es-AR lee como número. */
export const importeCsv = (n: number) => n.toFixed(2).replace('.', ',');

export function guardarCsv(nombre: string, encabezado: string[], filas: (string | number)[][]): void {
  const lineas = [encabezado, ...filas].map((fila) => fila.map(celda).join(';'));
  const contenido = `﻿${lineas.join('\r\n')}\r\n`;
  const url = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}
