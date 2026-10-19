import { archivoCsv, importe, linea } from '../../core/csv';
import { VinculoUnidad, type Unidad, type UnidadUsuario } from '../../database/entities';

/**
 * El padrón de un consorcio para Excel: una fila por unidad con sus
 * propietarios e inquilinos vigentes y cómo contactarlos. Es lo que pide un
 * estudio contable o una asamblea para armar la convocatoria.
 */

const COLUMNAS = [
  'Unidad',
  'Tipo',
  'Piso',
  'Departamento',
  'Coeficiente (%)',
  'Metros cuadrados',
  'Estado',
  'Propietarios',
  'Email propietarios',
  'Teléfono propietarios',
  'Inquilinos',
  'Email inquilinos',
  'Teléfono inquilinos',
];

/** Varias personas en una celda: "Ana Gómez / Luis Gómez". El titular viene primero. */
const juntar = (valores: (string | null)[]) => valores.filter(Boolean).join(' / ');

export function aCsvPadron(unidades: Unidad[], vinculos: UnidadUsuario[]): string {
  const porUnidad = new Map<string, UnidadUsuario[]>();
  for (const v of vinculos) porUnidad.set(v.unidadId, [...(porUnidad.get(v.unidadId) ?? []), v]);

  const filas = unidades.map((u) => {
    const deLaUnidad = porUnidad.get(u.id) ?? [];
    const propietarios = deLaUnidad.filter((v) => v.vinculo === VinculoUnidad.PROPIETARIO).map((v) => v.usuario);
    const inquilinos = deLaUnidad.filter((v) => v.vinculo === VinculoUnidad.INQUILINO).map((v) => v.usuario);
    return linea([
      u.etiqueta,
      u.tipo,
      u.piso,
      u.departamento,
      // El coeficiente lleva sus 4 decimales: redondearlo a 2 descuadraría el 100%.
      u.coeficiente.toFixed(4).replace('.', ','),
      u.metrosCuadrados === null ? '' : importe(u.metrosCuadrados),
      u.activa ? 'Activa' : 'Inactiva',
      juntar(propietarios.map((p) => `${p.nombre} ${p.apellido}`)),
      juntar(propietarios.map((p) => p.email)),
      juntar(propietarios.map((p) => p.telefono)),
      juntar(inquilinos.map((p) => `${p.nombre} ${p.apellido}`)),
      juntar(inquilinos.map((p) => p.email)),
      juntar(inquilinos.map((p) => p.telefono)),
    ]);
  });

  return archivoCsv([linea(COLUMNAS), ...filas]);
}
