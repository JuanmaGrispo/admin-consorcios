export type RolUsuario = 'SUPER_ADMIN' | 'ADMINISTRADOR' | 'VECINO';

export interface Usuario {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: RolUsuario;
  activo: boolean;
}

export interface CreateUsuarioInput {
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  rol?: 'ADMINISTRADOR' | 'VECINO';
}
