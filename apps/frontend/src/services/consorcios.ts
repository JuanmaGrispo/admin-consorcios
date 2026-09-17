import { api } from '@/lib/api';
import type { Consorcio, ConsorcioInput } from '@/types/consorcio';

export const consorciosService = {
  list: () => api<Consorcio[]>('/consorcios'),

  get: (id: string) => api<Consorcio>(`/consorcios/${id}`),

  create: (input: ConsorcioInput) =>
    api<Consorcio>('/consorcios', { method: 'POST', body: JSON.stringify(input) }),

  update: (id: string, input: Partial<ConsorcioInput>) =>
    api<Consorcio>(`/consorcios/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),

  remove: (id: string) => api<void>(`/consorcios/${id}`, { method: 'DELETE' }),
};
