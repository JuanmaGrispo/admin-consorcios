import { archivoCsv, importe, linea } from '../../core/csv';
import { NaturalezaGasto, type Gasto, type Liquidacion } from '../../database/entities';
import { lineasCobranza, type FilaCobranza } from './cobranzas';

const NATURALEZAS: Record<NaturalezaGasto, string> = {
  [NaturalezaGasto.ORDINARIO]: 'Ordinario',
  [NaturalezaGasto.EXTRAORDINARIO]: 'Extraordinario',
  [NaturalezaGasto.FONDO_RESERVA]: 'Fondo de reserva',
};

const COLUMNAS_GASTOS = ['Rubro', 'Descripción', 'Proveedor', 'Naturaleza', 'Cuota', 'Comprobante', 'Monto'];

/** "2026-09-01" → "09/2026"; "2026-10-10" → "10/10/2026". */
const mesAnio = (periodo: string) => periodo.slice(0, 7).split('-').reverse().join('/');
const fecha = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');

/**
 * Una liquidación entera para Excel, en bloques separados por una línea vacía:
 * el resumen, los gastos con su rubro y proveedor, y —si ya se prorrateó— las
 * boletas por unidad con las mismas columnas que la grilla de cobranzas. Es el
 * archivo que se le pasa al estudio contable.
 */
export function aCsvLiquidacion(
  liquidacion: Pick<Liquidacion, 'periodo' | 'estado' | 'fechaVencimiento' | 'totalGastos' | 'totalEmitido'>,
  gastos: Gasto[],
  boletas: FilaCobranza[],
): string {
  const lineas = [
    linea(['Liquidación', mesAnio(liquidacion.periodo)]),
    linea(['Estado', liquidacion.estado]),
    linea(['Vencimiento', fecha(liquidacion.fechaVencimiento)]),
    linea(['Total de gastos', importe(liquidacion.totalGastos)]),
    linea(['Total emitido', importe(liquidacion.totalEmitido)]),
    '',
    linea(['Gastos']),
    linea(COLUMNAS_GASTOS),
    ...gastos.map((g) =>
      linea([
        g.rubro?.nombre,
        g.descripcion,
        g.proveedor?.razonSocial,
        NATURALEZAS[g.naturaleza] ?? g.naturaleza,
        g.cuotaNumero && g.cuotaTotal ? `${g.cuotaNumero} de ${g.cuotaTotal}` : '',
        g.comprobanteNumero,
        importe(g.monto),
      ]),
    ),
  ];

  // En borrador todavía no hay boletas: el archivo trae sólo los gastos.
  if (boletas.length > 0) lineas.push('', linea(['Boletas por unidad']), ...lineasCobranza(boletas));

  return archivoCsv(lineas);
}
