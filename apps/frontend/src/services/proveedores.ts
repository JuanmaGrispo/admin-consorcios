import { api, query } from '@/lib/api';
import type { Proveedor, ProveedorInput } from '@/types/catalogo';

/** Una función por endpoint de /proveedores. Todo es del administrador. */
export const proveedoresService = {
  /** Con `consorcioId`, los de ese consorcio más los compartidos. */
  listar: (filtros: { consorcioId?: string; buscar?: string; incluirInactivos?: boolean } = {}) =>
    api<Proveedor[]>(`/proveedores${query(filtros)}`),

  crear: (input: ProveedorInput) =>
    api<Proveedor>('/proveedores', { method: 'POST', body: JSON.stringify(input) }),

  /** No hay DELETE: con `activo: false` se da de baja, porque gastos y reclamos lo referencian. */
  actualizar: (
    id: string,
    input: Omit<Partial<ProveedorInput>, 'consorcioId'> & { activo?: boolean },
  ) => api<Proveedor>(`/proveedores/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
};
