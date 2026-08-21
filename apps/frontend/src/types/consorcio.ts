export interface Consorcio {
  id: string;
  nombre: string;
  direccion: string;
  unidades: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateConsorcioInput {
  nombre: string;
  direccion: string;
  unidades?: number;
}

export type UpdateConsorcioInput = Partial<CreateConsorcioInput>;
