import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatearNumeroRecibo } from './recibo';

describe('formatearNumeroRecibo', () => {
  it('rellena el correlativo a ocho dígitos', () => {
    assert.equal(formatearNumeroRecibo(1), '0001-00000001');
    assert.equal(formatearNumeroRecibo(48_712), '0001-00048712');
  });

  it('un correlativo más largo que ocho dígitos no se trunca', () => {
    assert.equal(formatearNumeroRecibo(1_234_567_890), '0001-1234567890');
  });
});
