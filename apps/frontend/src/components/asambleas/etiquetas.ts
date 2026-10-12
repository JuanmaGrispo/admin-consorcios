import type { EstadoAsamblea, ModalidadAsamblea, TipoAsamblea } from '@/types/asamblea';

export const TIPOS: Record<TipoAsamblea, string> = {
  ORDINARIA: 'Ordinaria',
  EXTRAORDINARIA: 'Extraordinaria',
};

export const MODALIDADES: Record<ModalidadAsamblea, string> = {
  PRESENCIAL: 'Presencial',
  HIBRIDA: 'Híbrida',
  DIGITAL: 'Digital',
};

/** Dónde se hace: el lugar, el link o los dos, según la modalidad. */
export function dondeSeHace(a: {
  modalidad: ModalidadAsamblea;
  lugar: string | null;
  linkVideollamada: string | null;
}): string {
  if (a.modalidad === 'DIGITAL') return 'Videollamada';
  if (a.modalidad === 'HIBRIDA') return [a.lugar, 'videollamada'].filter(Boolean).join(' + ');
  return a.lugar ?? '—';
}

const CERRADAS: EstadoAsamblea[] = ['CERRADA', 'CERRADA_SIN_QUORUM'];

/** Ya terminó: con quórum o sin él. */
export function estaCerrada(a: { estado: EstadoAsamblea }): boolean {
  return CERRADAS.includes(a.estado);
}

/** El año de la asamblea en Buenos Aires: una del 31/12 a las 22 h es de ese año, no del siguiente. */
export function anioDe(fechaHora: string): number {
  return Number(
    new Date(fechaHora).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric' }),
  );
}
