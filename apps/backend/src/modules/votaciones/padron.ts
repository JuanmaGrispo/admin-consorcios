import { FormaConteo, PadronVotacion, VinculoUnidad } from '../../database/entities';

export interface UnidadParaPadron {
  unidadId: string;
  etiqueta: string;
  coeficiente: number;
  /** Vínculos vigentes de la unidad. */
  vinculos: { usuarioId: string; vinculo: VinculoUnidad }[];
}

export interface UnidadHabilitada {
  unidadId: string;
  etiqueta: string;
  /** Coeficiente o 1, según la forma de conteo. */
  peso: number;
  /** Quiénes pueden votar por esta unidad desde la app. */
  votantes: string[];
}

/**
 * Qué unidades votan y quién por cada una. Una unidad sin nadie que la pueda
 * representar no entra: no tendría quién vote y sólo inflaría el total.
 */
export function armarPadron(
  unidades: UnidadParaPadron[],
  padron: PadronVotacion,
  forma: FormaConteo,
): Map<string, UnidadHabilitada> {
  const habilitadas = new Map<string, UnidadHabilitada>();
  for (const unidad of unidades) {
    const votantes = [
      ...new Set(
        unidad.vinculos
          .filter(
            (v) =>
              padron === PadronVotacion.TODAS_LAS_UNIDADES || v.vinculo === VinculoUnidad.PROPIETARIO,
          )
          .map((v) => v.usuarioId),
      ),
    ];
    if (votantes.length === 0) continue;
    habilitadas.set(unidad.unidadId, {
      unidadId: unidad.unidadId,
      etiqueta: unidad.etiqueta,
      peso: forma === FormaConteo.POR_UNIDAD ? 1 : unidad.coeficiente,
      votantes,
    });
  }
  return habilitadas;
}

export function pesoTotal(padron: Map<string, UnidadHabilitada>): number {
  let total = 0;
  for (const unidad of padron.values()) total += unidad.peso;
  return Math.round(total * 10_000) / 10_000;
}
