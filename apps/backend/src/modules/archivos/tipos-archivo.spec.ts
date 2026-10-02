import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RolUsuario } from '../../database/entities';
import {
  DestinoArchivo,
  REGLAS,
  TAMANIO_MAXIMO_ABSOLUTO,
  TipoArchivo,
  detectarTipo,
  enMegas,
  extensionDe,
  nombrarTipos,
} from './tipos-archivo';

/** Cabeceras reales de cada formato, con relleno detrás. */
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)]);
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(16),
]);
const webp = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.alloc(4),
  Buffer.from('WEBP', 'ascii'),
  Buffer.alloc(16),
]);
const pdf = Buffer.concat([Buffer.from('%PDF-1.7', 'ascii'), Buffer.alloc(16)]);

describe('detectarTipo', () => {
  it('reconoce los cuatro formatos que aceptamos', () => {
    assert.equal(detectarTipo(jpeg), TipoArchivo.JPEG);
    assert.equal(detectarTipo(png), TipoArchivo.PNG);
    assert.equal(detectarTipo(webp), TipoArchivo.WEBP);
    assert.equal(detectarTipo(pdf), TipoArchivo.PDF);
  });

  it('un ejecutable disfrazado de imagen no pasa', () => {
    // ELF: lo que se subiría si sólo creyéramos en el Content-Type.
    assert.equal(detectarTipo(Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01])), null);
  });

  it('un RIFF que no es WebP tampoco', () => {
    const wav = Buffer.concat([
      Buffer.from('RIFF', 'ascii'),
      Buffer.alloc(4),
      Buffer.from('WAVE', 'ascii'),
      Buffer.alloc(16),
    ]);
    assert.equal(detectarTipo(wav), null);
  });

  it('un archivo vacío o cortado no rompe', () => {
    assert.equal(detectarTipo(Buffer.alloc(0)), null);
    assert.equal(detectarTipo(Buffer.from([0xff, 0xd8])), null);
    assert.equal(detectarTipo(Buffer.from('RIFF', 'ascii')), null);
    assert.equal(detectarTipo(Buffer.from('%PDF', 'ascii')), null);
  });

  it('no se deja engañar por la firma en el medio del archivo', () => {
    assert.equal(detectarTipo(Buffer.concat([Buffer.alloc(4), pdf])), null);
  });
});

describe('REGLAS', () => {
  it('a un reclamo el vecino sube fotos, no PDFs', () => {
    const regla = REGLAS[DestinoArchivo.RECLAMOS];
    assert.equal(regla.rol, null);
    assert.ok(!regla.tipos.includes(TipoArchivo.PDF));
  });

  it('un acta es un PDF firmado y la sube quien administra', () => {
    const regla = REGLAS[DestinoArchivo.ACTAS];
    assert.deepEqual(regla.tipos, [TipoArchivo.PDF]);
    assert.equal(regla.rol, RolUsuario.ADMINISTRADOR);
  });

  it('todos los destinos del enum tienen regla', () => {
    for (const destino of Object.values(DestinoArchivo)) {
      assert.ok(REGLAS[destino], `falta la regla de ${destino}`);
    }
  });

  it('el tope absoluto cubre al destino más permisivo', () => {
    for (const regla of Object.values(REGLAS)) {
      assert.ok(regla.tamanioMaximo <= TAMANIO_MAXIMO_ABSOLUTO);
    }
  });
});

describe('mensajes', () => {
  it('nombra los tipos como los conoce el usuario', () => {
    assert.equal(
      nombrarTipos([TipoArchivo.JPEG, TipoArchivo.PNG, TipoArchivo.PDF]),
      'JPG, PNG, PDF',
    );
  });

  it('expresa el tamaño en megas', () => {
    assert.equal(enMegas(8 * 1024 * 1024), '8 MB');
  });

  it('cada tipo tiene extensión', () => {
    for (const tipo of Object.values(TipoArchivo)) {
      assert.ok(extensionDe(tipo).length > 0);
    }
  });
});
