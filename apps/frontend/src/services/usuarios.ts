import { api } from '@/lib/api';
import type { CreateUsuarioInput, Usuario } from '@/types/usuario';

export const usuariosService = {
  administradores: () => api<Usuario[]>('/usuarios?rol=ADMINISTRADOR'),

  create: (input: CreateUsuarioInput) =>
    api<Usuario>('/usuarios', { method: 'POST', body: JSON.stringify(input) }),
};
