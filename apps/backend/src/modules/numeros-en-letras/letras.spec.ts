import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { enteroEnLetras, importeEnLetras, leerIngles } from './letras';

describe('enteroEnLetras', () => {
  const casos: [number, string][] = [
    [0, 'cero'],
    [1, 'uno'],
    [15, 'quince'],
    [16, 'dieciséis'],
    [21, 'veintiuno'],
    [30, 'treinta'],
    [45, 'cuarenta y cinco'],
    [100, 'cien'],
    [101, 'ciento uno'],
    [500, 'quinientos'],
    [999, 'novecientos noventa y nueve'],
    [1000, 'mil'],
    [1001, 'mil uno'],
    [21_000, 'veintiún mil'],
    [31_000, 'treinta y un mil'],
    [101_000, 'ciento un mil'],
    [100_000, 'cien mil'],
    [145_320, 'ciento cuarenta y cinco mil trescientos veinte'],
    [1_000_000, 'un millón'],
    [2_500_000, 'dos millones quinientos mil'],
    [21_000_000, 'veintiún millones'],
    [1_500_000_000, 'mil quinientos millones'],
  ];
  for (const [n, esperado] of casos) {
    it(`${n} → ${esperado}`, () => assert.equal(enteroEnLetras(n), esperado));
  }

  it('rechaza negativos y decimales', () => {
    assert.throws(() => enteroEnLetras(-1), RangeError);
    assert.throws(() => enteroEnLetras(1.5), RangeError);
  });
});

describe('importeEnLetras', () => {
  it('escribe los centavos como fracción', () => {
    assert.equal(
      importeEnLetras(145_320.5),
      'SON PESOS CIENTO CUARENTA Y CINCO MIL TRESCIENTOS VEINTE CON 50/100',
    );
  });

  it('sin centavos pone 00/100', () => {
    assert.equal(importeEnLetras(1000), 'SON PESOS MIL CON 00/100');
  });

  it('redondea los centavos sin errores de coma flotante', () => {
    assert.equal(importeEnLetras(11_812.5), 'SON PESOS ONCE MIL OCHOCIENTOS DOCE CON 50/100');
    assert.equal(importeEnLetras(0.29), 'SON PESOS CERO CON 29/100');
  });

  it('usa las letras que se le pasan para el entero', () => {
    assert.equal(importeEnLetras(20.1, 'veinte'), 'SON PESOS VEINTE CON 10/100');
  });
});

describe('leerIngles', () => {
  it('lee la respuesta del servicio', () => {
    assert.equal(leerIngles('one hundred and forty five thousand three hundred and twenty '), 145_320);
  });

  it('lee millones, guiones y cero', () => {
    assert.equal(leerIngles('two million five hundred thousand'), 2_500_000);
    assert.equal(leerIngles('twenty-one'), 21);
    assert.equal(leerIngles('zero'), 0);
  });

  it('devuelve null si no son palabras de un número', () => {
    assert.equal(leerIngles('Server was unable to process request'), null);
    assert.equal(leerIngles(''), null);
  });
});
