import type { TipoUnidad, VinculoUnidad } from '@/types/unidad';

export const TIPOS_UNIDAD: Record<TipoUnidad, string> = {
  DEPARTAMENTO: 'Departamento',
  LOCAL: 'Local',
  COCHERA: 'Cochera',
  BAULERA: 'Baulera',
};

export const VINCULOS: Record<VinculoUnidad, string> = {
  PROPIETARIO: 'Propietario',
  INQUILINO: 'Inquilino',
};

/** Los coeficientes se comparan en diezmilésimos, como el backend: 33,3333 × 3 + 0,0001 da 100. */
export function sumaCoeficientes(coeficientes: number[]): number {
  return coeficientes.reduce((total, c) => total + Math.round(c * 10_000), 0) / 10_000;
}
