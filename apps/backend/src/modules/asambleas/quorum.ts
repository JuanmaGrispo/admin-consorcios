import { EstadoAsistencia } from '../../database/entities';

/** Lo mínimo de una asistencia que hace falta para medir el quórum. */
export interface AsistenciaParaQuorum {
  estado: EstadoAsistencia;
  coeficienteAplicado: number;
}

export interface Quorum {
  /** Porcentaje de coeficientes presentes, con dos decimales. */
  porcentaje: number;
  requerido: number;
  alcanzado: boolean;
  /** Puntos porcentuales que faltan para el requerido (0 si se alcanzó). */
  faltanPuntos: number;
  /**
   * Cuántas unidades sin responder harían falta, tomando primero las de mayor
   * coeficiente. `null` si ni confirmando todas se llega.
   */
  faltanUnidades: number | null;
  conteo: Record<EstadoAsistencia, number>;
}

/** Cuentan para el quórum quien asiste y quien está representado por poder. */
const PRESENTES = new Set<EstadoAsistencia>([EstadoAsistencia.ASISTE, EstadoAsistencia.CON_PODER]);

const redondear = (n: number) => Math.round(n * 100) / 100;

export function porcentajeDeQuorum(presente: number, total: number): number {
  return total > 0 ? redondear((presente / total) * 100) : 0;
}

/**
 * Quórum por coeficiente: la suma de los coeficientes presentes sobre la suma
 * de todos los coeficientes convocados. Se usa el coeficiente copiado al
 * convocar, no el actual de la unidad.
 */
export function calcularQuorum(asistencias: AsistenciaParaQuorum[], requerido: number): Quorum {
  const conteo: Record<EstadoAsistencia, number> = {
    [EstadoAsistencia.ASISTE]: 0,
    [EstadoAsistencia.NO_ASISTE]: 0,
    [EstadoAsistencia.SIN_RESPONDER]: 0,
    [EstadoAsistencia.CON_PODER]: 0,
  };
  let total = 0;
  let presente = 0;
  for (const asistencia of asistencias) {
    conteo[asistencia.estado] += 1;
    total += asistencia.coeficienteAplicado;
    if (PRESENTES.has(asistencia.estado)) presente += asistencia.coeficienteAplicado;
  }

  const porcentaje = porcentajeDeQuorum(presente, total);
  const alcanzado = total > 0 && porcentaje >= requerido;

  return {
    porcentaje,
    requerido,
    alcanzado,
    faltanPuntos: alcanzado ? 0 : redondear(requerido - porcentaje),
    faltanUnidades: alcanzado ? 0 : unidadesQueFaltan(asistencias, presente, total, requerido),
    conteo,
  };
}

function unidadesQueFaltan(
  asistencias: AsistenciaParaQuorum[],
  presente: number,
  total: number,
  requerido: number,
): number | null {
  const pendientes = asistencias
    .filter((a) => a.estado === EstadoAsistencia.SIN_RESPONDER)
    .map((a) => a.coeficienteAplicado)
    .sort((x, y) => y - x);

  let acumulado = presente;
  for (let i = 0; i < pendientes.length; i++) {
    acumulado += pendientes[i];
    if (porcentajeDeQuorum(acumulado, total) >= requerido) return i + 1;
  }
  return null;
}
