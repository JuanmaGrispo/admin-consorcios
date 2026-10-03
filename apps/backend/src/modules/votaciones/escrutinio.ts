import { CriterioDesempate, MayoriaRequerida, ResultadoVotacion } from '../../database/entities';

export interface OpcionParaEscrutinio {
  id: string;
  etiqueta: string;
}

export interface VotoParaEscrutinio {
  opcionId: string;
  /** Coeficiente de la unidad o 1, según la forma de conteo. */
  peso: number;
}

export interface ReglasEscrutinio {
  mayoria: MayoriaRequerida;
  desempate: CriterioDesempate;
  aFavorId: string;
  enContraId: string;
  /** Peso total del padrón: el 100% para la mayoría absoluta y los dos tercios. */
  pesoPadron: number;
  /** De asamblea, y la asamblea no tenía quórum al cerrar la votación. */
  sinQuorum?: boolean;
}

export interface ConteoOpcion {
  opcionId: string;
  etiqueta: string;
  peso: number;
  votos: number;
  /** Sobre lo emitido, con dos decimales. */
  porcentaje: number;
}

export interface Escrutinio {
  opciones: ConteoOpcion[];
  pesoEmitido: number;
  /** Peso emitido sobre el del padrón, en %. */
  participacion: number;
  resultado: ResultadoVotacion;
}

/** Los coeficientes tienen 4 decimales: comparar más fino sólo mide ruido de punto flotante. */
const r4 = (n: number) => Math.round(n * 10_000) / 10_000;
const r2 = (n: number) => Math.round(n * 100) / 100;

export function escrutar(
  opciones: OpcionParaEscrutinio[],
  votos: VotoParaEscrutinio[],
  reglas: ReglasEscrutinio,
): Escrutinio {
  const acumulado = new Map(opciones.map((o) => [o.id, { peso: 0, votos: 0 }]));
  let emitido = 0;
  for (const voto of votos) {
    const cuenta = acumulado.get(voto.opcionId);
    if (!cuenta) continue;
    cuenta.peso += voto.peso;
    cuenta.votos += 1;
    emitido += voto.peso;
  }
  emitido = r4(emitido);

  const conteo = opciones.map((o): ConteoOpcion => {
    const cuenta = acumulado.get(o.id)!;
    return {
      opcionId: o.id,
      etiqueta: o.etiqueta,
      peso: r4(cuenta.peso),
      votos: cuenta.votos,
      porcentaje: emitido > 0 ? r2((cuenta.peso / emitido) * 100) : 0,
    };
  });

  const aFavor = acumulado.get(reglas.aFavorId)?.peso ?? 0;
  const enContra = acumulado.get(reglas.enContraId)?.peso ?? 0;

  return {
    opciones: conteo,
    pesoEmitido: emitido,
    participacion: reglas.pesoPadron > 0 ? r2((emitido / reglas.pesoPadron) * 100) : 0,
    resultado: decidir(aFavor, enContra, emitido, reglas),
  };
}

function decidir(
  aFavor: number,
  enContra: number,
  emitido: number,
  reglas: ReglasEscrutinio,
): ResultadoVotacion {
  if (reglas.sinQuorum || emitido === 0) return ResultadoVotacion.SIN_QUORUM;

  const desempate =
    reglas.desempate === CriterioDesempate.APROBADA
      ? ResultadoVotacion.APROBADA
      : ResultadoVotacion.RECHAZADA;

  switch (reglas.mayoria) {
    case MayoriaRequerida.SIMPLE_PRESENTES:
      return comparar(aFavor, enContra, desempate);
    case MayoriaRequerida.ABSOLUTA:
      return comparar(aFavor, reglas.pesoPadron / 2, desempate);
    case MayoriaRequerida.DOS_TERCIOS:
      // Alcanzar los dos tercios ya aprueba: no hay empate posible.
      return r4(aFavor * 3) >= r4(reglas.pesoPadron * 2)
        ? ResultadoVotacion.APROBADA
        : ResultadoVotacion.RECHAZADA;
  }
}

function comparar(a: number, b: number, empate: ResultadoVotacion): ResultadoVotacion {
  const [x, y] = [r4(a), r4(b)];
  if (x > y) return ResultadoVotacion.APROBADA;
  if (x < y) return ResultadoVotacion.RECHAZADA;
  return empate;
}
