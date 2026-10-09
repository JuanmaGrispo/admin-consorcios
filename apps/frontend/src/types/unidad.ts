export type TipoUnidad = 'DEPARTAMENTO' | 'LOCAL' | 'COCHERA' | 'BAULERA';

/** GET /unidades: al vecino le devuelve las suyas; al administrador, las de sus consorcios. */
export interface Unidad {
  id: string;
  consorcioId: string;
  /** "3º B", "PB Local". */
  etiqueta: string;
  piso: string | null;
  departamento: string | null;
  tipo: TipoUnidad;
  /** Porcentaje (1.74 es 1,74%). */
  coeficiente: number;
  metrosCuadrados: number | null;
  activa: boolean;
  /** Vínculos vigentes: cuántos vecinos tiene hoy. */
  cantidadVecinos?: number;
}
