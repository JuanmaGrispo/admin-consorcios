import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FormaConteo, PadronVotacion, VinculoUnidad } from '../../database/entities';
import { armarPadron, pesoTotal, type UnidadParaPadron, vistaDelPadron } from './padron';

const { PROPIETARIO, INQUILINO } = VinculoUnidad;

const UNIDADES: UnidadParaPadron[] = [
  { unidadId: 'u1', etiqueta: '1A', coeficiente: 2.5, vinculos: [{ usuarioId: 'p1', vinculo: PROPIETARIO }] },
  {
    unidadId: 'u2',
    etiqueta: '1B',
    coeficiente: 1.5,
    vinculos: [
      { usuarioId: 'p2', vinculo: PROPIETARIO },
      { usuarioId: 'i2', vinculo: INQUILINO },
    ],
  },
  { unidadId: 'u3', etiqueta: '2A', coeficiente: 3, vinculos: [{ usuarioId: 'i3', vinculo: INQUILINO }] },
  { unidadId: 'u4', etiqueta: '2B', coeficiente: 1, vinculos: [] },
];

describe('armarPadron', () => {
  it('solo propietarios: deja afuera la unidad sin propietario y al inquilino', () => {
    const padron = armarPadron(UNIDADES, PadronVotacion.SOLO_PROPIETARIOS, FormaConteo.POR_COEFICIENTE);
    assert.deepEqual([...padron.keys()], ['u1', 'u2']);
    assert.deepEqual(padron.get('u2')!.votantes, ['p2']);
  });

  it('todas las unidades: vota cualquier vínculo, pero no una unidad sin nadie', () => {
    const padron = armarPadron(UNIDADES, PadronVotacion.TODAS_LAS_UNIDADES, FormaConteo.POR_COEFICIENTE);
    assert.deepEqual([...padron.keys()], ['u1', 'u2', 'u3']);
    assert.deepEqual(padron.get('u2')!.votantes, ['p2', 'i2']);
  });

  it('por coeficiente pesa el coeficiente; por unidad, 1', () => {
    const porCoef = armarPadron(UNIDADES, PadronVotacion.SOLO_PROPIETARIOS, FormaConteo.POR_COEFICIENTE);
    const porUnidad = armarPadron(UNIDADES, PadronVotacion.SOLO_PROPIETARIOS, FormaConteo.POR_UNIDAD);
    assert.equal(pesoTotal(porCoef), 4);
    assert.equal(pesoTotal(porUnidad), 2);
  });

  it('un usuario vinculado dos veces a la misma unidad vota una sola', () => {
    const padron = armarPadron(
      [
        {
          unidadId: 'u1',
          etiqueta: '1A',
          coeficiente: 1,
          vinculos: [
            { usuarioId: 'p1', vinculo: PROPIETARIO },
            { usuarioId: 'p1', vinculo: PROPIETARIO },
          ],
        },
      ],
      PadronVotacion.SOLO_PROPIETARIOS,
      FormaConteo.POR_UNIDAD,
    );
    assert.deepEqual(padron.get('u1')!.votantes, ['p1']);
  });
});

describe('vistaDelPadron', () => {
  it('cuenta las habilitadas y nombra las que quedan sin votante', () => {
    const vista = vistaDelPadron(UNIDADES, PadronVotacion.SOLO_PROPIETARIOS, FormaConteo.POR_COEFICIENTE);
    assert.equal(vista.habilitadas, 2);
    assert.equal(vista.pesoTotal, 4);
    assert.deepEqual(vista.sinVotante.map((u) => u.etiqueta), ['2A', '2B']);
  });

  it('con todas las unidades, sólo queda afuera la que no tiene a nadie', () => {
    const vista = vistaDelPadron(UNIDADES, PadronVotacion.TODAS_LAS_UNIDADES, FormaConteo.POR_UNIDAD);
    assert.deepEqual(vista.sinVotante.map((u) => u.etiqueta), ['2B']);
    assert.equal(vista.pesoTotal, 3);
  });
});
