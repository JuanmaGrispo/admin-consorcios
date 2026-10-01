import PDFDocument from 'pdfkit';
import type { Boleta, Consorcio } from '../../database/entities';
import { aCentavos, aPesos } from './prorrateo';

const pesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
const fecha = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');
/** "2026-09-01" → "septiembre 2026". En UTC: el período es una fecha sin hora. */
const mes = (periodo: string) =>
  new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${periodo.slice(0, 10)}T00:00:00Z`))
    .replace(' de ', ' ');

/** Lo que se imprime del consorcio. */
export type DatosConsorcio = Pick<
  Consorcio,
  'nombre' | 'calle' | 'numero' | 'ciudad' | 'cuit' | 'cbu'
>;

const MARGEN = 50;
const ANCHO = 595.28 - MARGEN * 2; // A4
const COLUMNA_MONTO = 120;

/**
 * La boleta impresa: encabezado del consorcio, detalle línea por línea,
 * resumen y lo que queda por pagar. Usa las fuentes base de PDF (Helvetica),
 * que traen acentos y ñ sin embeber nada.
 */
export function generarBoletaPdf(
  boleta: Boleta,
  consorcio: DatosConsorcio,
  pagado: number,
): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: MARGEN });
  const partes: Buffer[] = [];
  doc.on('data', (parte: Buffer) => partes.push(parte));
  const terminado = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);
  });

  const { liquidacion, unidad } = boleta;
  const direccion = [consorcio.calle, consorcio.numero].filter(Boolean).join(' ');

  // ── Encabezado ──
  doc.font('Helvetica-Bold').fontSize(16).text(consorcio.nombre);
  doc.font('Helvetica').fontSize(9).fillColor('#555');
  if (direccion) doc.text([direccion, consorcio.ciudad].filter(Boolean).join(', '));
  if (consorcio.cuit) doc.text(`CUIT ${consorcio.cuit}`);
  doc.fillColor('#000').moveDown();

  doc.font('Helvetica-Bold').fontSize(13).text(`Expensas de ${mes(liquidacion.periodo)}`);
  doc.font('Helvetica').fontSize(10);
  doc.text(`Unidad ${unidad.etiqueta} · coeficiente ${boleta.coeficienteAplicado}%`);
  doc.text(`Vence el ${fecha(liquidacion.fechaVencimiento)} · Estado: ${boleta.estado}`);
  doc.moveDown();

  // ── Detalle ──
  const fila = (concepto: string, monto: number, negrita = false) => {
    const y = doc.y;
    doc.font(negrita ? 'Helvetica-Bold' : 'Helvetica');
    doc.text(concepto, MARGEN, y, { width: ANCHO - COLUMNA_MONTO });
    const alto = doc.y;
    doc.text(pesos.format(monto), MARGEN + ANCHO - COLUMNA_MONTO, y, {
      width: COLUMNA_MONTO,
      align: 'right',
    });
    doc.y = Math.max(alto, doc.y);
    doc.x = MARGEN;
  };
  const linea = () => {
    doc.moveTo(MARGEN, doc.y + 2).lineTo(MARGEN + ANCHO, doc.y + 2).strokeColor('#ccc').stroke();
    doc.moveDown(0.5);
  };

  doc.font('Helvetica-Bold').fontSize(11).text('Detalle');
  linea();
  doc.fontSize(10);
  // Sólo los gastos: fondo, saldo, mora y ajuste van en el resumen de abajo.
  for (const d of boleta.boletaDetalles ?? []) if (d.gastoId) fila(d.concepto, d.monto);
  linea();

  // ── Resumen ──
  fila('Expensas ordinarias', boleta.importeOrdinarias);
  fila('Expensas extraordinarias', boleta.importeExtraordinarias);
  fila('Fondo de reserva', boleta.fondoReserva);
  if (boleta.saldoAnterior) fila('Saldo anterior', boleta.saldoAnterior);
  if (boleta.interesesMora) fila('Intereses por mora', boleta.interesesMora);
  if (boleta.ajusteManual) fila(`Ajuste: ${boleta.motivoAjuste ?? ''}`, boleta.ajusteManual);
  linea();
  fila('Total', boleta.total, true);
  if (pagado > 0) {
    fila('Pagado', pagado);
    fila('Saldo', aPesos(Math.max(0, aCentavos(boleta.total) - aCentavos(pagado))), true);
  }

  if (consorcio.cbu) {
    doc.moveDown(2).font('Helvetica').fontSize(9).fillColor('#555');
    doc.text(`Para pagar por transferencia: CBU ${consorcio.cbu}`);
  }

  doc.end();
  return terminado;
}
