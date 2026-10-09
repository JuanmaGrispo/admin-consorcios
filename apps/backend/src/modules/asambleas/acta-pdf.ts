import PDFDocument from 'pdfkit';
import type { Asamblea, Asistencia, Consorcio } from '../../database/entities';
import { EstadoAsistencia, ResultadoVotacion } from '../../database/entities';
import type { Quorum } from './quorum';

export type DatosConsorcio = Pick<Consorcio, 'nombre' | 'calle' | 'numero' | 'ciudad'>;

export interface VotacionDelActa {
  puntoOrdenDiaId: string | null;
  titulo: string;
  resultado: ResultadoVotacion | null;
}

export interface DatosActa {
  asamblea: Asamblea;
  consorcio: DatosConsorcio;
  quorum: Quorum | null;
  asistencias: Asistencia[];
  votaciones: VotacionDelActa[];
}

const MARGEN = 50;
const ANCHO = 595.28 - MARGEN * 2; // A4
const ZONA = 'America/Argentina/Buenos_Aires';

const fechaYHora = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA,
  dateStyle: 'long',
  timeStyle: 'short',
});

/** 54.3 → "54,3%". */
const pct = (n: number) => `${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}%`;

const ASISTENCIA: Record<EstadoAsistencia, string> = {
  [EstadoAsistencia.ASISTE]: 'Asiste',
  [EstadoAsistencia.CON_PODER]: 'Con poder',
  [EstadoAsistencia.NO_ASISTE]: 'No asiste',
  [EstadoAsistencia.SIN_RESPONDER]: 'Sin responder',
};

const RESULTADO: Record<ResultadoVotacion, string> = {
  [ResultadoVotacion.APROBADA]: 'Aprobada',
  [ResultadoVotacion.RECHAZADA]: 'Rechazada',
  [ResultadoVotacion.SIN_QUORUM]: 'Sin quórum',
};

/**
 * El borrador del acta: lo que el sistema sabe de la asamblea (quórum,
 * asistencia, orden del día y resultado de cada votación) para que el
 * administrador lo complete, lo firme y lo suba como acta definitiva. Se
 * genera al vuelo, como la boleta y el recibo.
 */
export function generarActaPdf({ asamblea, consorcio, quorum, asistencias, votaciones }: DatosActa): Promise<Buffer> {
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
  doc.fillColor('#000').moveDown();

  doc.font('Helvetica-Bold').fontSize(13).text(`Acta · ${asamblea.titulo}`);
  doc.font('Helvetica').fontSize(10);
  doc.text(`Asamblea ${asamblea.tipo.toLowerCase()} · ${fechaYHora.format(asamblea.fechaHora)}`);
  if (asamblea.lugar) doc.text(`Lugar: ${asamblea.lugar}`);
  doc.fillColor('#b45309').fontSize(9).text('Borrador generado por el sistema: completar y firmar.');
  doc.fillColor('#000').moveDown();

  // ── Quórum ──
  doc.font('Helvetica-Bold').fontSize(11).text('Quórum');
  doc.font('Helvetica').fontSize(10);
  if (quorum) {
    doc.text(
      `${pct(quorum.porcentaje)} de los coeficientes sobre ${pct(quorum.requerido)} requerido: ${
        quorum.alcanzado ? 'alcanzado' : 'no alcanzado'
      }.`,
    );
    doc.text(
      `Asisten ${quorum.conteo.ASISTE} · con poder ${quorum.conteo.CON_PODER} · no asisten ${quorum.conteo.NO_ASISTE} · sin responder ${quorum.conteo.SIN_RESPONDER}.`,
    );
  } else {
    doc.text('Todavía no se convocó: no hay padrón.');
  }
  doc.moveDown();

  // ── Orden del día ──
  doc.font('Helvetica-Bold').fontSize(11).text('Orden del día');
  doc.font('Helvetica').fontSize(10);
  const puntos = [...(asamblea.puntoOrdenDias ?? [])].sort((a, b) => a.orden - b.orden);
  for (const punto of puntos) {
    const votacion = votaciones.find((v) => v.puntoOrdenDiaId === punto.id);
    const resultado = votacion
      ? ` · Votación: ${votacion.resultado ? RESULTADO[votacion.resultado] : 'sin cerrar'}`
      : '';
    doc.text(`${punto.orden}. ${punto.titulo}${resultado}`, { width: ANCHO });
    if (punto.descripcion) doc.fillColor('#555').text(punto.descripcion, { width: ANCHO }).fillColor('#000');
  }
  doc.moveDown();

  // ── Asistencia ──
  doc.font('Helvetica-Bold').fontSize(11).text('Asistencia');
  doc.font('Helvetica').fontSize(9);
  for (const a of asistencias) {
    const poder = a.apoderadoUnidad ? ` (poder a ${a.apoderadoUnidad.etiqueta})` : '';
    doc.text(`${a.unidad?.etiqueta ?? a.unidadId} · ${pct(a.coeficienteAplicado)} · ${ASISTENCIA[a.estado]}${poder}`);
  }

  doc.moveDown(2).fontSize(10);
  doc.text('_______________________          _______________________');
  doc.text('Firma administración                    Firma presidente de la asamblea');

  doc.end();
  return terminado;
}
