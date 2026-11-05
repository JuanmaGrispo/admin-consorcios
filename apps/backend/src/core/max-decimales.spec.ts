import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAsambleaDto } from '../modules/asambleas/dto/create-asamblea.dto';
import { AjustarBoletaDto } from '../modules/expensas/dto/ajustar-boleta.dto';
import { CreateGastoDto } from '../modules/expensas/dto/create-gasto.dto';
import { RegistrarPagoDto } from '../modules/pagos/dto/registrar-pago.dto';
import { CreateAmenityDto } from '../modules/reservas/dto/create-amenity.dto';
import { CreateUnidadDto } from '../modules/unidades/dto/create-unidad.dto';
import { tieneMaxDecimales } from './max-decimales';

describe('tieneMaxDecimales', () => {
  it('acepta hasta el máximo de decimales', () => {
    assert.ok(tieneMaxDecimales(12.34, 2));
    assert.ok(tieneMaxDecimales(0.1, 2));
    assert.ok(tieneMaxDecimales(-1500, 2));
    assert.ok(tieneMaxDecimales(4.5678, 4));
    assert.ok(tieneMaxDecimales(999_999_999_999.99, 2));
  });

  it('rechaza un decimal de más', () => {
    assert.ok(!tieneMaxDecimales(12.345, 2));
    assert.ok(!tieneMaxDecimales(1.005, 2));
    assert.ok(!tieneMaxDecimales(4.56789, 4));
  });

  // DEF-18: JavaScript escribe estos números en notación exponencial, sin punto.
  it('rechaza sin romperse los números en notación exponencial', () => {
    assert.ok(!tieneMaxDecimales(1e-7, 4));
    assert.ok(!tieneMaxDecimales(-5e-324, 2));
    assert.ok(tieneMaxDecimales(1e21, 2));
  });

  it('rechaza lo que no es un número finito', () => {
    for (const valor of [NaN, Infinity, '12.3', null, undefined]) assert.ok(!tieneMaxDecimales(valor, 2), String(valor));
  });
});

// Antes, cada uno de estos campos respondía 500 con 0.0000001.
describe('campos con tope de decimales (DEF-18)', () => {
  const campos: Array<[string, new () => object, string]> = [
    ['unidad', CreateUnidadDto, 'coeficiente'],
    ['unidad', CreateUnidadDto, 'metrosCuadrados'],
    ['asamblea', CreateAsambleaDto, 'quorumRequerido'],
    ['amenity', CreateAmenityDto, 'montoSena'],
    ['ajuste de boleta', AjustarBoletaDto, 'ajusteManual'],
    ['gasto', CreateGastoDto, 'monto'],
    ['pago', RegistrarPagoDto, 'monto'],
  ];
  for (const [nombre, dto, campo] of campos) {
    it(`${nombre}.${campo}: 0.0000001 es un error de validación, no una excepción`, async () => {
      const errores = await validate(plainToInstance(dto, { [campo]: 0.0000001 }));
      const delCampo = errores.find((e) => e.property === campo);
      assert.ok(delCampo?.constraints?.maxDecimales, `sin error de decimales en ${campo}`);
    });
  }
});
