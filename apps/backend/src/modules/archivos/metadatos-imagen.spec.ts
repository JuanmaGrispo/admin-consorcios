import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { quitarMetadatos } from './metadatos-imagen';
import { TipoArchivo, detectarTipo } from './tipos-archivo';

/** Texto que simula la posición GPS dentro de los metadatos. */
const GPS = 'GPS-34.6037S-58.3816W';
const PIXELES = Buffer.from([0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88]);

const contiene = (b: Buffer, texto: string) => b.includes(Buffer.from(texto, 'latin1'));

// ── JPEG ────────────────────────────────────────────────────────────────────

function segmento(marcador: number, datos: Buffer): Buffer {
  const cabecera = Buffer.from([0xff, marcador, 0, 0]);
  cabecera.writeUInt16BE(datos.length + 2, 2);
  return Buffer.concat([cabecera, datos]);
}

/** Un EXIF big-endian con la orientación y, al final, el texto de "GPS". */
function exif(orientacion: number | null): Buffer {
  const entradas = orientacion === null ? 0 : 1;
  const tiff = Buffer.alloc(8 + 2 + entradas * 12 + 4);
  tiff.write('MM', 0, 'latin1');
  tiff.writeUInt16BE(42, 2);
  tiff.writeUInt32BE(8, 4);
  tiff.writeUInt16BE(entradas, 8);
  if (orientacion !== null) {
    tiff.writeUInt16BE(0x0112, 10);
    tiff.writeUInt16BE(3, 12);
    tiff.writeUInt32BE(1, 14);
    tiff.writeUInt16BE(orientacion, 18);
  }
  return Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff, Buffer.from(GPS, 'latin1')]);
}

function jpeg({ orientacion = 6 as number | null } = {}): Buffer {
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    segmento(0xe0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'latin1')),
    segmento(0xe1, exif(orientacion)),
    segmento(0xe1, Buffer.from(`http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>${GPS}</x:xmpmeta>`, 'latin1')),
    segmento(0xe2, Buffer.from('ICC_PROFILE\0perfil', 'latin1')),
    segmento(0xfe, Buffer.from(`comentario ${GPS}`, 'latin1')),
    segmento(0xdb, Buffer.alloc(65, 1)), // tabla de cuantización
    segmento(0xda, Buffer.from([0x01, 0x01, 0x00, 0x00, 0x3f, 0x00])),
    PIXELES,
    Buffer.from([0xff, 0xd9]),
  ]);
}

describe('quitarMetadatos — JPEG', () => {
  it('saca la posición GPS del EXIF, el XMP y los comentarios', () => {
    const limpio = quitarMetadatos(jpeg(), TipoArchivo.JPEG);
    assert.equal(contiene(jpeg(), GPS), true);
    assert.equal(contiene(limpio, GPS), false);
    assert.equal(contiene(limpio, 'xmpmeta'), false);
    assert.equal(contiene(limpio, 'comentario'), false);
  });

  it('conserva JFIF, el perfil de color, las tablas y los píxeles sin tocar', () => {
    const limpio = quitarMetadatos(jpeg(), TipoArchivo.JPEG);
    assert.equal(detectarTipo(limpio), TipoArchivo.JPEG);
    assert.equal(contiene(limpio, 'JFIF'), true);
    assert.equal(contiene(limpio, 'ICC_PROFILE'), true);
    assert.equal(limpio.includes(Buffer.alloc(65, 1)), true);
    assert.deepEqual(limpio.subarray(-PIXELES.length - 2, -2), PIXELES);
    assert.deepEqual(limpio.subarray(-2), Buffer.from([0xff, 0xd9]));
  });

  it('conserva sólo la orientación, en un EXIF nuevo después de JFIF', () => {
    const limpio = quitarMetadatos(jpeg({ orientacion: 6 }), TipoArchivo.JPEG);
    const app1 = limpio.indexOf(Buffer.from('Exif\0\0', 'latin1'));
    assert.ok(app1 > limpio.indexOf(Buffer.from('JFIF', 'latin1')));
    // Exif\0\0 + "MM" 42 IFD0@8, 1 entrada: 0x0112 SHORT 1 → 6
    const tiff = limpio.subarray(app1 + 6);
    assert.equal(tiff.readUInt16BE(8), 1);
    assert.equal(tiff.readUInt16BE(10), 0x0112);
    assert.equal(tiff.readUInt16BE(18), 6);
  });

  it('sin orientación, o con la normal (1), no deja ningún EXIF', () => {
    for (const orientacion of [null, 1]) {
      const limpio = quitarMetadatos(jpeg({ orientacion }), TipoArchivo.JPEG);
      assert.equal(contiene(limpio, 'Exif'), false, `orientación ${orientacion}`);
    }
  });

  it('una foto sin metadatos queda igual', () => {
    const sinNada = Buffer.concat([
      Buffer.from([0xff, 0xd8]),
      segmento(0xdb, Buffer.alloc(65, 1)),
      segmento(0xda, Buffer.from([0x01, 0x01, 0x00, 0x00, 0x3f, 0x00])),
      PIXELES,
      Buffer.from([0xff, 0xd9]),
    ]);
    assert.deepEqual(quitarMetadatos(sinNada, TipoArchivo.JPEG), sinNada);
  });

  it('un JPEG con la estructura rota se devuelve como llegó', () => {
    const roto = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);
    assert.deepEqual(quitarMetadatos(roto, TipoArchivo.JPEG), roto);
  });
});

// ── PNG ─────────────────────────────────────────────────────────────────────

function chunkPng(tipo: string, datos: Buffer): Buffer {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  return Buffer.concat([largo, Buffer.from(tipo, 'latin1'), datos, Buffer.from([1, 2, 3, 4])]);
}

const png = () =>
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunkPng('IHDR', Buffer.alloc(13, 7)),
    chunkPng('eXIf', Buffer.from(`MM\0*${GPS}`, 'latin1')),
    chunkPng('tEXt', Buffer.from(`Comment\0${GPS}`, 'latin1')),
    chunkPng('iTXt', Buffer.from(`XML:com.adobe.xmp\0\0\0\0\0${GPS}`, 'latin1')),
    chunkPng('IDAT', PIXELES),
    chunkPng('IEND', Buffer.alloc(0)),
  ]);

describe('quitarMetadatos — PNG', () => {
  it('saca eXIf y los chunks de texto, y deja IHDR, IDAT e IEND intactos', () => {
    const limpio = quitarMetadatos(png(), TipoArchivo.PNG);
    assert.equal(contiene(limpio, GPS), false);
    assert.equal(detectarTipo(limpio), TipoArchivo.PNG);
    const esperado = Buffer.concat([
      png().subarray(0, 8),
      chunkPng('IHDR', Buffer.alloc(13, 7)),
      chunkPng('IDAT', PIXELES),
      chunkPng('IEND', Buffer.alloc(0)),
    ]);
    assert.deepEqual(limpio, esperado);
  });

  it('un PNG cortado se devuelve como llegó', () => {
    const cortado = png().subarray(0, 40);
    assert.deepEqual(quitarMetadatos(cortado, TipoArchivo.PNG), cortado);
  });
});

// ── WebP ────────────────────────────────────────────────────────────────────

function chunkWebp(tipo: string, datos: Buffer): Buffer {
  const cabecera = Buffer.alloc(8);
  cabecera.write(tipo, 0, 'latin1');
  cabecera.writeUInt32LE(datos.length, 4);
  return Buffer.concat([cabecera, datos, datos.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
}

function webp(): Buffer {
  const vp8x = Buffer.alloc(10);
  vp8x[0] = 0x08 | 0x04 | 0x10; // EXIF, XMP y alfa
  const cuerpo = Buffer.concat([
    Buffer.from('WEBP', 'latin1'),
    chunkWebp('VP8X', vp8x),
    chunkWebp('VP8 ', PIXELES),
    chunkWebp('EXIF', Buffer.from(`MM\0*${GPS}`, 'latin1')),
    chunkWebp('XMP ', Buffer.from(`<x:xmpmeta>${GPS}</x:xmpmeta>`, 'latin1')),
  ]);
  const riff = Buffer.alloc(8);
  riff.write('RIFF', 0, 'latin1');
  riff.writeUInt32LE(cuerpo.length, 4);
  return Buffer.concat([riff, cuerpo]);
}

describe('quitarMetadatos — WebP', () => {
  it('saca EXIF y XMP, apaga sus banderas y corrige el tamaño del RIFF', () => {
    const limpio = quitarMetadatos(webp(), TipoArchivo.WEBP);
    assert.equal(contiene(limpio, GPS), false);
    assert.equal(detectarTipo(limpio), TipoArchivo.WEBP);
    assert.equal(limpio.readUInt32LE(4), limpio.length - 8);
    const banderas = limpio[12 + 8];
    assert.equal(banderas & 0x08, 0, 'bandera EXIF');
    assert.equal(banderas & 0x04, 0, 'bandera XMP');
    assert.equal(banderas & 0x10, 0x10, 'el alfa se conserva');
    assert.equal(limpio.includes(chunkWebp('VP8 ', PIXELES)), true);
  });
});

describe('quitarMetadatos — otros tipos', () => {
  it('un PDF no se toca', () => {
    const pdf = Buffer.from(`%PDF-1.7 ${GPS}`, 'latin1');
    assert.deepEqual(quitarMetadatos(pdf, TipoArchivo.PDF), pdf);
  });
});
