import { api, query } from '@/lib/api';
import type { CreateUsuarioInput, Usuario, UsuarioCambios } from '@/types/usuario';

/** Una función por endpoint de /usuarios (cuentas que gestiona la administración). */
export const usuariosService = {
  administradores: () => api<Usuario[]>('/usuarios?rol=ADMINISTRADOR'),

  /** El administrador recibe los vecinos de sus consorcios. Con `email`, busca uno exacto. */
  listar: (filtros: { consorcioId?: string; buscar?: string; email?: string } = {}) =>
    api<Usuario[]>(`/usuarios${query(filtros)}`),

  obtener: (id: string) => api<Usuario>(`/usuarios/${id}`),

  create: (input: CreateUsuarioInput) =>
    api<Usuario>('/usuarios', { method: 'POST', body: JSON.stringify(input) }),

  actualizar: (id: string, cambios: UsuarioCambios) =>
    api<Usuario>(`/usuarios/${id}`, { method: 'PATCH', body: JSON.stringify(cambios) }),

  /** Le pone una contraseña nueva (mínimo 8 caracteres). */
  resetearPassword: (id: string, password: string) =>
    api<void>(`/usuarios/${id}/password`, { method: 'PUT', body: JSON.stringify({ password }) }),
};
