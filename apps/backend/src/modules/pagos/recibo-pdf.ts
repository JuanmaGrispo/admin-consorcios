import PDFDocument from 'pdfkit';
import type { Consorcio, MedioPago, Pago } from '../../database/entities';

const pesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
const fechaYHora = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Argentina/Buenos_Aires',
});
/** "2026-08-01" → "agosto 2026". En UTC: el período es una fecha sin hora. */
const mes = (periodo: string) =>
  new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${periodo.slice(0, 10)}T00:00:00Z`))
    .replace(' de ', ' ');

/** Cómo se lee cada medio en el recibo. */
const MEDIOS: Record<MedioPago, string> = {
  MERCADO_PAGO: 'Mercado Pago',
  TRANSFERENCIA: 'Transferencia bancaria',
  EFECTIVO: 'Efectivo',
  OTRO: 'Otro',
} as Record<MedioPago, string>;

/** Lo que se imprime del consorcio. */
export type DatosConsorcio = Pick<Consorcio, 'nombre' | 'calle' | 'numero' | 'ciudad' | 'cuit'>;

export interface DatosRecibo {
  pago: Pago;
  /** La unidad a la que se le imputó el pago. */
  etiquetaUnidad: string;
  /** Período de la boleta (AAAA-MM-DD), o null si el pago no es de una boleta. */
  periodo: string | null;
  consorcio: DatosConsorcio;
}

const MARGEN = 50;
const ANCHO = 595.28 - MARGEN * 2; // A4
const COLUMNA_VALOR = 200;

/**
 * El comprobante de un pago aprobado. Mismo criterio que la boleta: se genera
 * al vuelo con las fuentes base de PDF (Helvetica), que traen acentos y ñ sin
 * embeber nada, y no se guarda en disco.
 */
export function generarReciboPdf({
  pago,
  etiquetaUnidad,
  periodo,
  consorcio,
}: DatosRecibo): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: MARGEN });
  const partes: Buffer[] = [];
  doc.on('data', (parte: Buffer) => partes.push(parte));
  const terminado = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);
  });

  const direccion = [consorcio.calle, consorcio.numero].filter(Boolean).join(' ');

  // ── Encabezado ──
  doc.font('Helvetica-Bold').fontSize(16).text(consorcio.nombre);
  doc.font('Helvetica').fontSize(9).fillColor('#555');
  if (direccion) doc.text([direccion, consorcio.ciudad].filter(Boolean).join(', '));
  if (consorcio.cuit) doc.text(`CUIT ${consorcio.cuit}`);
  doc.fillColor('#000').moveDown();

  doc.font('Helvetica-Bold').fontSize(13).text('Recibo de pago');
  doc.font('Helvetica').fontSize(10).fillColor('#555');
  doc.text(`N° ${pago.reciboNumero ?? 'sin asignar'}`);
  doc.fillColor('#000').moveDown();

  // ── Importe ──
  doc.font('Helvetica').fontSize(9).fillColor('#555').text('Recibimos');
  doc.font('Helvetica-Bold').fontSize(22).fillColor('#000').text(pesos.format(pago.monto));
  doc.moveDown();

  // ── Datos ──
  const dato = (etiqueta: string, valor: string) => {
    const y = doc.y;
    doc.font('Helvetica').fontSize(10).fillColor('#555');
    doc.text(etiqueta, MARGEN, y, { width: COLUMNA_VALOR });
    doc.fillColor('#000').text(valor, MARGEN + COLUMNA_VALOR, y, {
      width: ANCHO - COLUMNA_VALOR,
    });
    doc.x = MARGEN;
    doc.moveDown(0.4);
  };

  doc.moveTo(MARGEN, doc.y).lineTo(MARGEN + ANCHO, doc.y).strokeColor('#ccc').stroke();
  doc.moveDown(0.6);

  dato('Unidad', etiquetaUnidad);
  if (periodo) dato('Período', mes(periodo));
  dato('Medio de pago', MEDIOS[pago.medio] ?? pago.medio);
  // El id de Mercado Pago es con lo que el vecino reclama si algo no cierra.
  if (pago.mpPaymentId) dato('Operación', pago.mpPaymentId);
  dato('Fecha', fechaYHora.format(pago.fechaPago ?? pago.createdAt));
  dato('Estado', 'Aprobado');

  doc.moveDown(0.6);
  doc.moveTo(MARGEN, doc.y).lineTo(MARGEN + ANCHO, doc.y).strokeColor('#ccc').stroke();

  doc.moveDown(1.5).font('Helvetica').fontSize(9).fillColor('#555');
  doc.text(
    'Este recibo acredita el pago recibido. Si el pago cubre el total de la boleta, la unidad queda al día; si fue parcial, el saldo sigue vigente.',
    { width: ANCHO },
  );

  doc.end();
  return terminado;
}
