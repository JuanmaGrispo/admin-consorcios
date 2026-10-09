export type TipoAdjunto = 'IMAGEN' | 'PDF' | 'OTRO';

export interface AdjuntoNovedad {
  id: string;
  url: string;
  nombre: string | null;
  tipo: TipoAdjunto;
}

/**
 * Una novedad del muro (GET /novedades). `leida` le llega sólo al vecino;
 * `lecturas` (cuántos vecinos la leyeron), sólo al administrador.
 */
export interface Novedad {
  id: string;
  consorcioId: string;
  autorId: string;
  autor: { id: string; nombre: string; apellido: string };
  titulo: string;
  cuerpo: string;
  fijada: boolean;
  /** Null sólo en una novedad que todavía no se publicó. */
  publicadaAt: string | null;
  /** `false`: dada de baja, ya no aparece en el muro del vecino. */
  activa: boolean;
  createdAt: string;
  novedadAdjuntos: AdjuntoNovedad[];
  leida?: boolean;
  lecturas?: number;
}

/** POST /novedades */
export interface NovedadInput {
  consorcioId: string;
  titulo: string;
  cuerpo: string;
  fijada?: boolean;
  /** Las URLs que devolvió `subirArchivo(archivo, 'novedades')`. Hasta 5. */
  adjuntos?: { url: string; nombre?: string }[];
}

/** PATCH /novedades/:id — los adjuntos no se editan. */
export type NovedadCambios = Partial<Pick<Novedad, 'titulo' | 'cuerpo' | 'fijada' | 'activa'>>;
