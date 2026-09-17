import type { ValueTransformer } from 'typeorm';

/**
 * `numeric` de Postgres llega como string al driver: el rango de numeric es más
 * grande que el de un number de JS, así que `pg` no lo convierte por las suyas.
 * En este esquema son plata, coeficientes y porcentajes — valores chicos — así
 * que convertirlos es seguro y evita que un `total * 1.1` termine concatenando.
 */
export const numericTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) =>
    value === null || value === undefined ? value : Number(value),
};
