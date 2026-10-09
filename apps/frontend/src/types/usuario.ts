export type RolUsuario = 'SUPER_ADMIN' | 'ADMINISTRADOR' | 'VECINO';

export interface Usuario {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: RolUsuario;
  activo: boolean;
  dni?: string | null;
  telefono?: string | null;
  avatarUrl?: string | null;
  createdAt?: string;
}

export interface CreateUsuarioInput {
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  rol?: 'ADMINISTRADOR' | 'VECINO';
}

/** PATCH /usuarios/:id: lo que el administrador corrige de un vecino. */
export type UsuarioCambios = Partial<Pick<Usuario, 'nombre' | 'apellido' | 'email' | 'dni' | 'telefono'>>;

/** PATCH /perfil: lo que cada uno edita de su cuenta. `avatarUrl: null` saca la foto. */
export type PerfilCambios = Partial<Pick<Usuario, 'nombre' | 'apellido' | 'telefono' | 'avatarUrl'>>;

export type CanalNotificacion = 'EMAIL' | 'WHATSAPP' | 'PUSH';
export type CategoriaNotificacion = 'BOLETAS' | 'VENCIMIENTOS' | 'RECLAMOS_RESERVAS' | 'COMUNICADOS';

/** Una fila de GET /perfil/preferencias: un canal con sus categorías. */
export interface PreferenciasDeCanal {
  canal: CanalNotificacion;
  /** false si el canal todavía no envía: se muestra como "Pronto". */
  disponible: boolean;
  categorias: { categoria: CategoriaNotificacion; habilitado: boolean }[];
}

/** PUT /perfil/preferencias: sólo lo que cambia. */
export interface PreferenciaCambio {
  canal: CanalNotificacion;
  categoria: CategoriaNotificacion;
  habilitado: boolean;
}
