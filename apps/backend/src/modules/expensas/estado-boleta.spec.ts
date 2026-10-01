import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EstadoBoleta } from '../../database/entities';
import { estadoBoleta } from './estado-boleta';

const VENCE = '2026-11-10';

describe('estadoBoleta', () => {
  it('sin pagos y en fecha, pendiente', () => {
    assert.equal(estadoBoleta(1_000, 0, VENCE, '2026-11-01'), EstadoBoleta.PENDIENTE);
  });

  it('con un pago a cuenta, parcial', () => {
    assert.equal(estadoBoleta(1_000, 400, VENCE, '2026-11-01'), EstadoBoleta.PARCIAL);
  });

  it('pagada completa, aunque se pague después del vencimiento', () => {
    assert.equal(estadoBoleta(1_000, 1_000, VENCE, '2026-12-01'), EstadoBoleta.PAGADA);
  });

  it('el día del vencimiento todavía no está vencida', () => {
    assert.equal(estadoBoleta(1_000, 0, VENCE, VENCE), EstadoBoleta.PENDIENTE);
  });

  it('con saldo y pasado el vencimiento, vencida (aunque tenga pagos)', () => {
    assert.equal(estadoBoleta(1_000, 0, VENCE, '2026-11-11'), EstadoBoleta.VENCIDA);
    assert.equal(estadoBoleta(1_000, 999.99, VENCE, '2026-11-11'), EstadoBoleta.VENCIDA);
  });

  it('compara en centavos: 0,1 + 0,2 cubre 0,3', () => {
    assert.equal(estadoBoleta(0.3, 0.1 + 0.2, VENCE, '2026-11-01'), EstadoBoleta.PAGADA);
  });

  it('una boleta en cero nace pagada', () => {
    assert.equal(estadoBoleta(0, 0, VENCE, '2026-11-01'), EstadoBoleta.PAGADA);
  });
});
