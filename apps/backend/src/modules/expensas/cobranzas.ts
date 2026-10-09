import { EstadoBoleta, MedioPago, VinculoUnidad } from '../../database/entities';
import type { SituacionBoleta } from './dto/listar-boletas.query';

/**
 * La grilla de cobranzas: una fila por boleta con lo que el administrador
 * necesita para decidir a quién reclamarle. La boleta sola no alcanza —no sabe
 * quién vive ahí ni cuánto se pagó—, así que el service le pega los ocupantes
 * y los pagos antes de devolverla.
 */

/** Un vecino como sale en la grilla: lo justo para mostrarlo y contactarlo. */
export interface VecinoDeFila {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string | null;
}

export interface FilaCobranza {
  id: string;
  unidad: { id: string; etiqueta: string; coeficiente: number };
  /** AAAA-MM: el día del período siempre es el 1. */
  periodo: string;
  fechaVencimiento: string;
  coeficienteAplicado: number;
  /** El titular, o el primer propietario vigente si nadie es titular. */
  propietario: VecinoDeFila | null;
  /** Si está alquilada, quién la ocupa. */
  inquilino: VecinoDeFila | null;
  emitido: number;
  pagado: number;
  saldo: number;
  /** Medio del último pago aprobado. Sin pagos, `null`. */
  medio: MedioPago | null;
  /** El último pago aprobado: para "Pagado el 08/08" y su recibo. Sin pagos, `null`. */
  ultimoPago: { id: string; fecha: Date } | null;
  estado: EstadoBoleta;
  interesesMora: number;
}

/**
 * De la solapa a los estados que la componen. `pendientes` incluye PARCIAL:
 * una boleta pagada a medias sigue teniendo saldo, y la pantalla la cuenta
 * entre las que faltan cobrar.
 */
export function estadosDe(situacion: SituacionBoleta): EstadoBoleta[] {
  switch (situacion) {
    case 'pagados':
      return [EstadoBoleta.PAGADA];
    case 'pendientes':
      return [EstadoBoleta.PENDIENTE, EstadoBoleta.PARCIAL];
    case 'vencidos':
      return [EstadoBoleta.VENCIDA];
  }
}

/** Los ocupantes vigentes de una unidad, ya separados por vínculo. */
export interface Ocupantes {
  propietario: VecinoDeFila | null;
  inquilino: VecinoDeFila | null;
}

/**
 * Elige a quién mostrar de cada lado. Una unidad puede tener varios vínculos
 * vigentes (dos hermanos propietarios, una pareja de inquilinos): manda el
 * titular, y si ninguno lo es, el primero que haya.
 */
export function elegirOcupantes(
  vinculos: { vinculo: VinculoUnidad; esTitular: boolean; vecino: VecinoDeFila }[],
): Ocupantes {
  const elegir = (cual: VinculoUnidad) => {
    const candidatos = vinculos.filter((v) => v.vinculo === cual);
    return (candidatos.find((v) => v.esTitular) ?? candidatos[0])?.vecino ?? null;
  };
  return {
    propietario: elegir(VinculoUnidad.PROPIETARIO),
    inquilino: elegir(VinculoUnidad.INQUILINO),
  };
}

// ── Exportación ──────────────────────────────────────────────────────────────

const COLUMNAS = [
  'Unidad',
  'Propietario',
  'Ocupación',
  'Coeficiente',
  'Período',
  'Vencimiento',
  'Emitido',
  'Pagado',
  'Saldo',
  'Intereses',
  'Medio',
  'Estado',
] as const;

const nombreDe = (v: VecinoDeFila | null) => (v ? `${v.nombre} ${v.apellido}` : '');

/** "Propietario" o "Alquilada · F. Ruiz", como en la grilla. */
export function ocupacionDe(fila: Pick<FilaCobranza, 'inquilino'>): string {
  if (!fila.inquilino) return 'Propietario';
  return `Alquilada · ${fila.inquilino.nombre.charAt(0)}. ${fila.inquilino.apellido}`;
}

/**
 * Una celda de CSV. Se entrecomilla siempre: los nombres traen comas y los
 * importes, la coma decimal de es-AR. Las comillas internas se duplican, que
 * es como las escapa el formato.
 */
const celda = (valor: string | number) => `"${String(valor).replace(/"/g, '""')}"`;

/** Importe con coma decimal, para que Excel en es-AR lo lea como número. */
const importe = (n: number) => n.toFixed(2).replace('.', ',');

/**
 * La grilla como CSV con `;` de separador y BOM: así Excel en español lo abre
 * en columnas de una, sin pasar por el asistente de importación. Es CSV y no
 * .xlsx a propósito: un xlsx real pide una dependencia nueva y Excel abre este
 * archivo igual.
 */
export function aCsv(filas: FilaCobranza[]): string {
  const lineas = [
    COLUMNAS.map(celda).join(';'),
    ...filas.map((f) =>
      [
        celda(f.unidad.etiqueta),
        celda(nombreDe(f.propietario)),
        celda(ocupacionDe(f)),
        celda(importe(f.coeficienteAplicado)),
        celda(f.periodo),
        celda(f.fechaVencimiento.split('-').reverse().join('/')),
        celda(importe(f.emitido)),
        celda(importe(f.pagado)),
        celda(importe(f.saldo)),
        celda(importe(f.interesesMora)),
        celda(f.medio ?? ''),
        celda(f.estado),
      ].join(';'),
    ),
  ];
  return `﻿${lineas.join('\r\n')}\r\n`;
}
