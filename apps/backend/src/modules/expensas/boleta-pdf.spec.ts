import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Boleta, Consorcio, EstadoBoleta } from '../../database/entities';
import { generarBoletaPdf } from './boleta-pdf';

const BOLETA = {
  id: 'b1',
  coeficienteAplicado: 12.5,
  importeOrdinarias: 100_000,
  importeExtraordinarias: 25_000,
  fondoReserva: 6_250,
  saldoAnterior: 10_000,
  interesesMora: 300,
  ajusteManual: -1_000,
  motivoAjuste: 'Bonificación por pintura del palier',
  total: 140_550,
  estado: EstadoBoleta.PARCIAL,
  liquidacion: { periodo: '2026-09-01', fechaVencimiento: '2026-10-10' },
  unidad: { etiqueta: '3º B' },
  boletaDetalles: [
    { concepto: 'Abono mensual ascensores', monto: 60_000, gastoId: 'g1' },
    { concepto: 'Limpieza y mantenimiento de espacios comunes, incluye materiales', monto: 40_000, gastoId: 'g2' },
    { concepto: 'Impermeabilización terraza (cuota 2 de 6)', monto: 25_000, gastoId: 'g3' },
    { concepto: 'Fondo de reserva', monto: 6_250, gastoId: null },
  ],
} as unknown as Boleta;

const CONSORCIO = {
  nombre: 'Av. Rivadavia 4820',
  calle: 'Av. Rivadavia',
  numero: '4820',
  ciudad: 'CABA',
  cuit: '30-12345678-9',
  cbu: '0000003100012345678901',
} as Consorcio;

describe('generarBoletaPdf', () => {
  it('genera un PDF válido', async () => {
    const pdf = await generarBoletaPdf(BOLETA, CONSORCIO, 50_000);
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.ok(pdf.length > 1_000);
  });

  it('banca un consorcio sin datos opcionales y una boleta sin detalle', async () => {
    const pdf = await generarBoletaPdf(
      { ...BOLETA, boletaDetalles: undefined } as Boleta,
      { nombre: 'Sin datos' } as Consorcio,
      0,
    );
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  });
});
