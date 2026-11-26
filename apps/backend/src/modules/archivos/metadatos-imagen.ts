import { TipoArchivo } from './tipos-archivo';

/**
 * Saca los metadatos de una imagen antes de guardarla (criterio ARC06).
 *
 * Una foto sacada con el celular trae en su EXIF la posición GPS, el modelo
 * del teléfono y la fecha, y el bucket la publica tal cual. Acá se reescribe
 * el archivo sin esos bloques, copiando los píxeles sin tocarlos (no se
 * recomprime nada, así que la calidad no cambia).
 *
 * - JPEG: se descartan APP1 (EXIF y XMP), APP3 a APP13, APP15 y los
 *   comentarios. Se conservan JFIF (APP0), el perfil de color (APP2) y el
 *   bloque Adobe (APP14), que hacen falta para mostrar bien los colores. La
 *   orientación es lo único del EXIF que se conserva, en un EXIF mínimo
 *   nuevo: sin ella, una foto sacada con el celular vertical se vería
 *   acostada.
 * - PNG: se descartan los chunks eXIf, tEXt, zTXt, iTXt y tIME.
 * - WebP: se descartan los chunks EXIF y XMP, y se apagan sus banderas en
 *   VP8X.
 *
 * Si el archivo no tiene la estructura esperada se devuelve igual que llegó:
 * es un archivo que el propio usuario armó a mano, no una foto de su
 * teléfono, y rechazarlo rompería subidas que hoy funcionan.
 */
export function quitarMetadatos(contenido: Buffer, tipo: TipoArchivo): Buffer {
  try {
    switch (tipo) {
      case TipoArchivo.JPEG:
        return limpiarJpeg(contenido) ?? contenido;
      case TipoArchivo.PNG:
        return limpiarPng(contenido) ?? contenido;
      case TipoArchivo.WEBP:
        return limpiarWebp(contenido) ?? contenido;
      default:
        return contenido;
    }
  } catch {
    return contenido;
  }
}

// ── JPEG ────────────────────────────────────────────────────────────────────

const SOI = 0xd8;
const SOS = 0xda;
const EOI = 0xd9;
const APP0 = 0xe0;
const APP1 = 0xe1;
const APP2 = 0xe2;
const APP14 = 0xee;
const COM = 0xfe;
const TAG_ORIENTACION = 0x0112;

/** Marcadores sin longitud: RST0 a RST7 y TEM. */
const sinLongitud = (m: number) => (m >= 0xd0 && m <= 0xd7) || m === 0x01;

function limpiarJpeg(c: Buffer): Buffer | null {
  if (c.length < 4 || c[0] !== 0xff || c[1] !== SOI) return null;
  const partes: Buffer[] = [c.subarray(0, 2)];
  let orientacion: number | null = null;
  let i = 2;

  while (i < c.length) {
    if (c[i] !== 0xff) return null;
    // Bytes de relleno 0xFF entre segmentos.
    while (i < c.length && c[i] === 0xff) i++;
    if (i >= c.length) return null;
    const marcador = c[i];
    const inicio = i - 1;
    i++;

    if (marcador === EOI) {
      partes.push(c.subarray(inicio, i));
      return armarJpeg(partes, orientacion, c.subarray(i));
    }
    if (sinLongitud(marcador)) {
      partes.push(c.subarray(inicio, i));
      continue;
    }
    if (i + 2 > c.length) return null;
    const largo = c.readUInt16BE(i);
    if (largo < 2 || i + largo > c.length) return null;
    const fin = i + largo;
    const datos = c.subarray(i + 2, fin);

    if (marcador === SOS) {
      // Desde acá vienen los píxeles: se copian tal cual hasta el final.
      partes.push(c.subarray(inicio));
      return armarJpeg(partes, orientacion);
    }

    const esApp = marcador >= APP0 && marcador <= 0xef;
    if (marcador === APP1 && datos.subarray(0, 6).toString('latin1') === 'Exif\0\0') {
      orientacion ??= leerOrientacion(datos.subarray(6));
    } else if (!(esApp || marcador === COM) || [APP0, APP2, APP14].includes(marcador)) {
      partes.push(c.subarray(inicio, fin));
    }
    i = fin;
  }
  return null;
}

/** Inserta el EXIF mínimo con la orientación justo después de SOI y JFIF. */
function armarJpeg(partes: Buffer[], orientacion: number | null, resto?: Buffer): Buffer {
  if (orientacion !== null && orientacion !== 1) {
    // Después de SOI (y de JFIF si está, que tiene que ir primero).
    const posicion = partes.length > 1 && partes[1][1] === APP0 ? 2 : 1;
    partes.splice(posicion, 0, exifConOrientacion(orientacion));
  }
  if (resto?.length) partes.push(resto);
  return Buffer.concat(partes);
}

/** Lee el tag Orientation del IFD0 de un bloque TIFF. */
function leerOrientacion(tiff: Buffer): number | null {
  if (tiff.length < 8) return null;
  const orden = tiff.subarray(0, 2).toString('latin1');
  if (orden !== 'II' && orden !== 'MM') return null;
  const le = orden === 'II';
  const u16 = (o: number) => (le ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o));
  const u32 = (o: number) => (le ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o));
  if (u16(2) !== 42) return null;
  const ifd = u32(4);
  if (ifd + 2 > tiff.length) return null;
  const entradas = u16(ifd);
  for (let n = 0; n < entradas; n++) {
    const e = ifd + 2 + n * 12;
    if (e + 12 > tiff.length) return null;
    if (u16(e) === TAG_ORIENTACION) {
      const valor = u16(e + 8);
      return valor >= 1 && valor <= 8 ? valor : null;
    }
  }
  return null;
}

/** Segmento APP1 con un EXIF que sólo tiene la orientación. */
function exifConOrientacion(orientacion: number): Buffer {
  const tiff = Buffer.alloc(26);
  tiff.write('MM', 0, 'latin1');
  tiff.writeUInt16BE(42, 2);
  tiff.writeUInt32BE(8, 4); // IFD0 empieza en el byte 8
  tiff.writeUInt16BE(1, 8); // una sola entrada
  tiff.writeUInt16BE(TAG_ORIENTACION, 10);
  tiff.writeUInt16BE(3, 12); // SHORT
  tiff.writeUInt32BE(1, 14); // un valor
  tiff.writeUInt16BE(orientacion, 18);
  tiff.writeUInt32BE(0, 22); // no hay IFD siguiente
  const datos = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
  const cabecera = Buffer.from([0xff, APP1, 0, 0]);
  cabecera.writeUInt16BE(datos.length + 2, 2);
  return Buffer.concat([cabecera, datos]);
}

// ── PNG ─────────────────────────────────────────────────────────────────────

const FIRMA_PNG = 8;
const CHUNKS_PNG_FUERA = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);

function limpiarPng(c: Buffer): Buffer | null {
  const partes: Buffer[] = [c.subarray(0, FIRMA_PNG)];
  let i = FIRMA_PNG;
  while (i < c.length) {
    if (i + 12 > c.length) return null;
    const largo = c.readUInt32BE(i);
    const tipo = c.subarray(i + 4, i + 8).toString('latin1');
    const fin = i + 12 + largo;
    if (fin > c.length) return null;
    if (!CHUNKS_PNG_FUERA.has(tipo)) partes.push(c.subarray(i, fin));
    i = fin;
    if (tipo === 'IEND') return Buffer.concat(partes);
  }
  return null;
}

// ── WebP ────────────────────────────────────────────────────────────────────

const CHUNKS_WEBP_FUERA = new Set(['EXIF', 'XMP ']);
const BANDERA_EXIF = 0x08;
const BANDERA_XMP = 0x04;

function limpiarWebp(c: Buffer): Buffer | null {
  if (c.length < 12) return null;
  const partes: Buffer[] = [];
  let i = 12;
  while (i < c.length) {
    if (i + 8 > c.length) return null;
    const tipo = c.subarray(i, i + 4).toString('latin1');
    const largo = c.readUInt32LE(i + 4);
    const fin = i + 8 + largo + (largo % 2); // los chunks se rellenan a par
    if (fin > c.length) return null;
    if (!CHUNKS_WEBP_FUERA.has(tipo)) {
      const chunk = Buffer.from(c.subarray(i, fin));
      if (tipo === 'VP8X' && largo >= 1) chunk[8] &= ~(BANDERA_EXIF | BANDERA_XMP);
      partes.push(chunk);
    }
    i = fin;
  }
  const cuerpo = Buffer.concat(partes);
  const cabecera = Buffer.from(c.subarray(0, 12));
  cabecera.writeUInt32LE(cuerpo.length + 4, 4); // "WEBP" + chunks
  return Buffer.concat([cabecera, cuerpo]);
}
