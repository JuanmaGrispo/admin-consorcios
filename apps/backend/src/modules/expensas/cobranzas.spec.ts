import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EstadoBoleta, MedioPago, VinculoUnidad } from '../../database/entities';
import { aCsv, elegirOcupantes, estadosDe, ocupacionDe, type FilaCobranza } from './cobranzas';

const vecino = (nombre: string, apellido: string) => ({
  id: `u-${apellido}`,
  nombre,
  apellido,
  email: `${apellido.toLowerCase()}@mail.com`,
  telefono: null,
});

describe('estadosDe', () => {
  it('pendientes incluye las parciales: lo que importa es que tienen saldo', () => {
    assert.deepEqual(estadosDe('pendientes'), [EstadoBoleta.PENDIENTE, EstadoBoleta.PARCIAL]);
  });

  it('pagados y vencidos son un estado cada uno', () => {
    assert.deepEqual(estadosDe('pagados'), [EstadoBoleta.PAGADA]);
    assert.deepEqual(estadosDe('vencidos'), [EstadoBoleta.VENCIDA]);
  });
});

describe('elegirOcupantes', () => {
  it('sin vínculos, no hay nadie', () => {
    assert.deepEqual(elegirOcupantes([]), { propietario: null, inquilino: null });
  });

  it('separa propietario de inquilino', () => {
    const { propietario, inquilino } = elegirOcupantes([
      { vinculo: VinculoUnidad.PROPIETARIO, esTitular: true, vecino: vecino('Marina', 'Cattaneo') },
      { vinculo: VinculoUnidad.INQUILINO, esTitular: false, vecino: vecino('Federico', 'Ruiz') },
    ]);
    assert.equal(propietario?.apellido, 'Cattaneo');
    assert.equal(inquilino?.apellido, 'Ruiz');
  });

  it('entre varios propietarios manda el titular', () => {
    const { propietario } = elegirOcupantes([
      { vinculo: VinculoUnidad.PROPIETARIO, esTitular: false, vecino: vecino('Ana', 'Primera') },
      { vinculo: VinculoUnidad.PROPIETARIO, esTitular: true, vecino: vecino('Beto', 'Titular') },
    ]);
    assert.equal(propietario?.apellido, 'Titular');
  });

  it('si ninguno es titular, el primero', () => {
    const { propietario } = elegirOcupantes([
      { vinculo: VinculoUnidad.PROPIETARIO, esTitular: false, vecino: vecino('Ana', 'Primera') },
      { vinculo: VinculoUnidad.PROPIETARIO, esTitular: false, vecino: vecino('Beto', 'Segundo') },
    ]);
    assert.equal(propietario?.apellido, 'Primera');
  });
});

describe('ocupacionDe', () => {
  it('sin inquilino, la habita el propietario', () => {
    assert.equal(ocupacionDe({ inquilino: null }), 'Propietario');
  });

  it('con inquilino, inicial y apellido', () => {
    assert.equal(ocupacionDe({ inquilino: vecino('Federico', 'Ruiz') }), 'Alquilada · F. Ruiz');
  });
});

const fila = (extra: Partial<FilaCobranza> = {}): FilaCobranza => ({
  id: 'b1',
  unidad: { id: 'u1', etiqueta: '3º B', coeficiente: 1.86 },
  periodo: '2026-08',
  fechaVencimiento: '2026-09-10',
  coeficienteAplicado: 1.86,
  propietario: vecino('Osvaldo', 'Pereyra'),
  inquilino: null,
  emitido: 155_520,
  pagado: 60_000,
  saldo: 95_520,
  medio: MedioPago.TRANSFERENCIA,
  ultimoPago: { id: 'p1', fecha: new Date('2026-09-05T12:00:00Z') },
  estado: EstadoBoleta.VENCIDA,
  interesesMora: 1_240.5,
  ...extra,
});

describe('aCsv', () => {
  it('arranca con BOM y la fila de encabezados', () => {
    const csv = aCsv([]);
    assert.ok(csv.startsWith('﻿'));
    assert.ok(csv.includes('"Unidad";"Propietario"'));
  });

  it('escribe los importes con coma decimal y la fecha en formato local', () => {
    const [, datos] = aCsv([fila()]).split('\r\n');
    assert.ok(datos.includes('"155520,00"'));
    assert.ok(datos.includes('"10/09/2026"'));
    assert.ok(datos.includes('"2026-08"'));
  });

  it('una boleta sin pagos sale con el medio vacío', () => {
    const [, datos] = aCsv([fila({ medio: null, pagado: 0, saldo: 155_520 })]).split('\r\n');
    assert.ok(datos.includes(';"";"VENCIDA"'));
  });

  it('duplica las comillas de un nombre para no romper la columna', () => {
    const csv = aCsv([
      fila({ propietario: { ...vecino('Juan', 'Pérez'), apellido: 'de "El" Valle' } }),
    ]);
    assert.ok(csv.includes('"Juan de ""El"" Valle"'));
  });

  it('una unidad alquilada dice quién la ocupa', () => {
    const csv = aCsv([fila({ inquilino: vecino('Laura', 'Paz') })]);
    assert.ok(csv.includes('"Alquilada · L. Paz"'));
  });
});
