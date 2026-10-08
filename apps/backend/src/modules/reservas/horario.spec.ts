import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cierraAlDiaSiguiente, franjaEnMinutos, largoDeVentana, validarFranja } from './horario';

const PARRILLA = { horaApertura: '10:00', horaCierre: '22:00', duracionMaximaHoras: 4 };
const SUM = { horaApertura: '10:00', horaCierre: '02:00', duracionMaximaHoras: 6 };
const COCHERA = { horaApertura: '00:00', horaCierre: '00:00', duracionMaximaHoras: 24 };

describe('largoDeVentana', () => {
  it('en el mismo día, la diferencia', () => {
    assert.equal(largoDeVentana('10:00', '22:00'), 12 * 60);
  });

  it('si cierra antes de abrir, cierra al día siguiente', () => {
    assert.equal(largoDeVentana('10:00', '02:00'), 16 * 60);
    assert.equal(cierraAlDiaSiguiente('10:00', '02:00'), true);
    assert.equal(cierraAlDiaSiguiente('10:00', '22:00'), false);
  });

  it('abrir y cerrar a la misma hora es estar abierto las 24 h', () => {
    assert.equal(largoDeVentana('00:00', '00:00'), 24 * 60);
  });
});

describe('franjaEnMinutos', () => {
  it('un fin anterior al inicio es del día siguiente', () => {
    assert.deepEqual(franjaEnMinutos('20:00', '02:00'), { inicio: 20 * 60, fin: 26 * 60 });
  });

  it('un fin igual al inicio son 24 h', () => {
    assert.deepEqual(franjaEnMinutos('13:00', '13:00'), { inicio: 13 * 60, fin: 37 * 60 });
  });
});

describe('validarFranja', () => {
  it('dentro de una ventana común', () => {
    assert.equal(validarFranja('12:00', '16:00', PARRILLA), null);
  });

  it('terminar justo a la hora de cierre es válido', () => {
    assert.equal(validarFranja('18:00', '22:00', PARRILLA), null);
  });

  it('fuera de una ventana común', () => {
    assert.equal(validarFranja('20:00', '23:00', PARRILLA), 'FUERA_DE_HORARIO');
    assert.equal(validarFranja('08:00', '11:00', PARRILLA), 'FUERA_DE_HORARIO');
  });

  it('una franja que cruza la medianoche entra en un SUM de 10:00 a 02:00', () => {
    assert.equal(validarFranja('20:00', '02:00', SUM), null);
    assert.equal(validarFranja('22:00', '01:00', SUM), null);
  });

  it('pasada la madrugada es de la ventana del día anterior', () => {
    assert.equal(validarFranja('00:30', '01:30', SUM), null);
  });

  it('el SUM no deja pasarse del cierre de la madrugada', () => {
    assert.equal(validarFranja('22:00', '03:00', SUM), 'FUERA_DE_HORARIO');
    assert.equal(validarFranja('01:00', '03:00', SUM), 'FUERA_DE_HORARIO');
  });

  it('respeta la duración máxima aunque cruce la medianoche', () => {
    assert.equal(validarFranja('18:00', '01:00', SUM), 'DEMASIADO_LARGA');
  });

  it('abierto las 24 h acepta una franja de un día entero', () => {
    assert.equal(validarFranja('13:00', '13:00', COCHERA), null);
    assert.equal(validarFranja('13:00', '13:00', { ...COCHERA, duracionMaximaHoras: 12 }), 'DEMASIADO_LARGA');
  });

  it('un fin antes del inicio en una ventana diurna queda fuera de horario', () => {
    assert.equal(validarFranja('16:00', '12:00', PARRILLA), 'FUERA_DE_HORARIO');
  });
});
