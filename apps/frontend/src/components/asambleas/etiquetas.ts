import type { ModalidadAsamblea, TipoAsamblea } from '@/types/asamblea';

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
