/**
 * Tipos de reclamos. Por ahora sólo el resumen, que usa la sidebar para el
 * contador; el módulo de reclamos suma acá el resto (Reclamo, ReclamoEvento…).
 */
export type EstadoReclamo = 'NUEVO' | 'EN_CURSO' | 'ESPERANDO_PROVEEDOR' | 'RESUELTO';

/** GET /reclamos/resumen */
export interface ResumenReclamos {
  porEstado: Record<EstadoReclamo, number>;
  abiertos: number;
  resueltos: number;
  diasPromedioResolucion: number | null;
}
