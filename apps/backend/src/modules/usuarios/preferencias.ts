import { CanalNotificacion, CategoriaNotificacion } from '../../database/entities';

/** Por ahora sólo sale mail: WhatsApp y push se guardan pero no envían nada. */
export const CANALES_DISPONIBLES = [CanalNotificacion.EMAIL];

export interface PreferenciasDeCanal {
  canal: CanalNotificacion;
  /** false si el canal todavía no envía: el front lo muestra como "Pronto". */
  disponible: boolean;
  categorias: { categoria: CategoriaNotificacion; habilitado: boolean }[];
}

/**
 * La grilla completa canal × categoría. Sin fila guardada, está habilitado:
 * es el default de la base, y nadie tiene que configurar nada para recibir
 * sus boletas.
 */
export function armarPreferencias(
  guardadas: { canal: CanalNotificacion; categoria: CategoriaNotificacion; habilitado: boolean }[],
): PreferenciasDeCanal[] {
  return Object.values(CanalNotificacion).map((canal) => ({
    canal,
    disponible: CANALES_DISPONIBLES.includes(canal),
    categorias: Object.values(CategoriaNotificacion).map((categoria) => ({
      categoria,
      habilitado:
        guardadas.find((g) => g.canal === canal && g.categoria === categoria)?.habilitado ?? true,
    })),
  }));
}
