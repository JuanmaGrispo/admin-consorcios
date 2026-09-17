import { api } from '@/lib/api';
import type { Usuario } from '@/types/usuario';

/** El login deja la cookie httpOnly; el token del body no se usa en la web. */
export const authService = {
  login: (email: string, password: string) =>
    api<{ usuario: Usuario }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: () => api<void>('/auth/logout', { method: 'POST' }),

  me: () => api<Usuario>('/auth/me'),
};
