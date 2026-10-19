import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EstadoBoleta, EstadoLiquidacion, NaturalezaGasto, type Gasto } from '../../database/entities';
import type { FilaCobranza } from './cobranzas';
import { aCsvLiquidacion } from './liquidacion-csv';

const LIQUIDACION = {
  periodo: '2026-09-01',
  estado: EstadoLiquidacion.EMITIDA,
  fechaVencimiento: '2026-10-10',
  totalGastos: 1_630_433.5,
  totalEmitido: 1_630_433.5,
};

const GASTO = {
  rubro: { nombre: 'Ascensores' },
  descripcion: 'Abono mensual',
  proveedor: { razonSocial: 'Nievas SRL' },
  naturaleza: NaturalezaGasto.ORDINARIO,
  cuotaNumero: 2,
  cuotaTotal: 6,
  comprobanteNumero: 'A-0001-123',
  monto: 60_000,
} as unknown as Gasto;

const BOLETA = {
  unidad: { etiqueta: '3º B' },
  propietario: { nombre: 'Ana', apellido: 'Gómez' },
  inquilino: null,
  coeficienteAplicado: 1.74,
  periodo: '2026-09',
  fechaVencimiento: '2026-10-10',
  emitido: 28_000,
  pagado: 0,
  saldo: 28_000,
  interesesMora: 0,
  medio: null,
  estado: EstadoBoleta.PENDIENTE,
} as unknown as FilaCobranza;

const lineas = (csv: string) => csv.slice(1).split('\r\n');

describe('aCsvLiquidacion', () => {
  it('arranca con el resumen de la liquidación', () => {
    const [periodo, estado, , total] = lineas(aCsvLiquidacion(LIQUIDACION, [], []));
    assert.equal(periodo, '"Liquidación";"09/2026"');
    assert.equal(estado, '"Estado";"EMITIDA"');
    assert.equal(total, '"Total de gastos";"1630433,50"');
  });

  it('cada gasto con su rubro, proveedor, cuota y comprobante', () => {
    const csv = aCsvLiquidacion(LIQUIDACION, [GASTO], []);
    assert.ok(
      lineas(csv).includes(
        '"Ascensores";"Abono mensual";"Nievas SRL";"Ordinario";"2 de 6";"A-0001-123";"60000,00"',
      ),
    );
  });

  it('sin boletas (en borrador) no agrega ese bloque', () => {
    assert.ok(!aCsvLiquidacion(LIQUIDACION, [GASTO], []).includes('Boletas por unidad'));
  });

  it('con boletas agrega el bloque con las columnas de cobranzas', () => {
    const l = lineas(aCsvLiquidacion(LIQUIDACION, [GASTO], [BOLETA]));
    const inicio = l.indexOf('"Boletas por unidad"');
    assert.ok(inicio > 0);
    assert.match(l[inicio + 1], /^"Unidad";"Propietario"/);
    assert.match(l[inicio + 2], /^"3º B";"Ana Gómez";"Propietario"/);
  });
});
