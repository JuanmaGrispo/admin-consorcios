import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { archivoCsv, celda, importe, linea } from './csv';

describe('csv', () => {
  it('entrecomilla y duplica las comillas internas', () => {
    assert.equal(celda('Pérez, "Tito"'), '"Pérez, ""Tito"""');
  });

  it('neutraliza un texto que Excel ejecutaría como fórmula', () => {
    assert.equal(celda('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
    assert.equal(celda('@SUM(A1)'), '"\'@SUM(A1)"');
  });

  it('deja los importes negativos como números', () => {
    assert.equal(celda(importe(-1500)), '"-1500,00"');
  });

  it('una celda vacía o nula queda vacía', () => {
    assert.equal(celda(null), '""');
    assert.equal(linea(['a', undefined, 2]), '"a";"";"2"');
  });

  it('el archivo lleva BOM y fin de línea de Windows', () => {
    const csv = archivoCsv(['"a"', '"b"']);
    assert.equal(csv.charCodeAt(0), 0xfeff);
    assert.equal(csv.slice(1), '"a"\r\n"b"\r\n');
  });
});
