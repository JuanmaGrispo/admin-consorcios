import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { crearSobre, validarSobre } from './eventos';

const votacionCerrada = () =>
  crearSobre('votacion.cerrada', 'c1', {
    votacion_id: 'vt1',
    titulo: 'Pintura',
    resultado: 'aprobada',
    participacion_pct: 62.5,
  });

describe('sobre de eventos', () => {
  it('arma el sobre común con id y timestamp', () => {
    const sobre = votacionCerrada();
    assert.match(sobre.evento_id, /^[0-9a-f-]{36}$/);
    assert.equal(sobre.tipo_evento, 'votacion.cerrada');
    assert.equal(sobre.consorcio_id, 'c1');
    assert.ok(!Number.isNaN(Date.parse(sobre.timestamp)));
    assert.equal(validarSobre(sobre), sobre);
  });

  it('acepta un cero en el payload', () => {
    const sobre = votacionCerrada();
    sobre.payload.participacion_pct = 0;
    assert.ok(validarSobre(sobre));
  });

  it('rechaza un tipo desconocido o un payload incompleto', () => {
    assert.equal(validarSobre({ ...votacionCerrada(), tipo_evento: 'otra.cosa' }), null);
    const incompleto = votacionCerrada() as unknown as { payload: Record<string, unknown> };
    delete incompleto.payload.resultado;
    assert.equal(validarSobre(incompleto), null);
    assert.equal(validarSobre('texto'), null);
    assert.equal(validarSobre(null), null);
  });

  it('sólo el aviso directo puede venir sin consorcio', () => {
    const aviso = crearSobre('aviso.directo', null, {
      destinatario_id: 'v1',
      asunto: 'Hola',
      cuerpo: 'Texto',
      origen: 'reserva:r1',
    });
    assert.ok(validarSobre(aviso));
    assert.equal(validarSobre({ ...votacionCerrada(), consorcio_id: null }), null);
  });
});
