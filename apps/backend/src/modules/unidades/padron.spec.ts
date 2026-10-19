import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TipoUnidad, VinculoUnidad, type Unidad, type UnidadUsuario } from '../../database/entities';
import { aCsvPadron } from './padron';

const unidad = (id: string, etiqueta: string, extra: Partial<Unidad> = {}) =>
  ({
    id,
    etiqueta,
    tipo: TipoUnidad.DEPARTAMENTO,
    piso: '3',
    departamento: 'B',
    coeficiente: 1.7425,
    metrosCuadrados: 54.5,
    activa: true,
    ...extra,
  }) as Unidad;

const vinculo = (unidadId: string, vinculo: VinculoUnidad, nombre: string, telefono: string | null = null) =>
  ({
    unidadId,
    vinculo,
    usuario: { nombre, apellido: 'Gómez', email: `${nombre.toLowerCase()}@mail.com`, telefono },
  }) as UnidadUsuario;

/** Las filas de datos, sin el BOM ni el encabezado. */
const filas = (csv: string) => csv.slice(1).trim().split('\r\n').slice(1);

describe('aCsvPadron', () => {
  it('una fila por unidad con propietarios e inquilinos', () => {
    const csv = aCsvPadron(
      [unidad('u1', '3º B')],
      [
        vinculo('u1', VinculoUnidad.PROPIETARIO, 'Ana', '11 4444-5555'),
        vinculo('u1', VinculoUnidad.INQUILINO, 'Luis'),
      ],
    );
    assert.deepEqual(filas(csv), [
      '"3º B";"DEPARTAMENTO";"3";"B";"1,7425";"54,50";"Activa";"Ana Gómez";"ana@mail.com";"11 4444-5555";"Luis Gómez";"luis@mail.com";""',
    ]);
  });

  it('junta varios propietarios en una celda', () => {
    const csv = aCsvPadron(
      [unidad('u1', '3º B')],
      [vinculo('u1', VinculoUnidad.PROPIETARIO, 'Ana'), vinculo('u1', VinculoUnidad.PROPIETARIO, 'Beto')],
    );
    assert.match(filas(csv)[0], /"Ana Gómez \/ Beto Gómez";"ana@mail.com \/ beto@mail.com"/);
  });

  it('una unidad sin vecinos ni metros sale igual, con las celdas vacías', () => {
    const csv = aCsvPadron([unidad('u2', 'PB Local', { metrosCuadrados: null, activa: false })], []);
    assert.match(filas(csv)[0], /^"PB Local";"DEPARTAMENTO";"3";"B";"1,7425";"";"Inactiva";"";"";"";"";"";""$/);
  });

  it('el encabezado nombra las columnas', () => {
    const encabezado = aCsvPadron([], []).slice(1).split('\r\n')[0];
    assert.match(encabezado, /^"Unidad";"Tipo";.*"Teléfono inquilinos"$/);
  });
});
