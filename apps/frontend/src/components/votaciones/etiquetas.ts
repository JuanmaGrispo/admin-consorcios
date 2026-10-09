import type {
  CriterioDesempate,
  FormaConteo,
  MayoriaRequerida,
  PadronVotacion,
} from '@/types/votacion';

/** Cómo se llama cada regla de una votación, en un solo lugar. */
export const MAYORIAS: Record<MayoriaRequerida, { etiqueta: string; ayuda: string }> = {
  SIMPLE_PRESENTES: {
    etiqueta: 'Mayoría simple',
    ayuda: 'Gana la opción con más votos entre quienes votaron.',
  },
  ABSOLUTA: {
    etiqueta: 'Mayoría absoluta',
    ayuda: 'Hace falta más de la mitad de todo el padrón, hayan votado o no.',
  },
  DOS_TERCIOS: {
    etiqueta: 'Dos tercios',
    ayuda: 'Hacen falta dos tercios de todo el padrón.',
  },
};

export const PADRONES: Record<PadronVotacion, string> = {
  SOLO_PROPIETARIOS: 'Sólo propietarios',
  TODAS_LAS_UNIDADES: 'Todas las unidades',
};

export const FORMAS_CONTEO: Record<FormaConteo, string> = {
  POR_COEFICIENTE: 'Por coeficiente',
  POR_UNIDAD: 'Un voto por unidad',
};

export const DESEMPATES: Record<CriterioDesempate, string> = {
  RECHAZADA: 'Se rechaza',
  APROBADA: 'Se aprueba',
};
