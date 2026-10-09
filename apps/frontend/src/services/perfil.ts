import { api, subirArchivo } from '@/lib/api';
import type { PerfilCambios, PreferenciaCambio, PreferenciasDeCanal, Usuario } from '@/types/usuario';

/** Una función por endpoint de /perfil: la cuenta de quien está logueado. */
export const perfilService = {
  obtener: () => api<Usuario>('/perfil'),

  actualizar: (cambios: PerfilCambios) =>
    api<Usuario>('/perfil', { method: 'PATCH', body: JSON.stringify(cambios) }),

  /** La grilla canal × categoría completa. Sin nada guardado, todo habilitado. */
  preferencias: () => api<PreferenciasDeCanal[]>('/perfil/preferencias'),

  /** Sólo lo que cambia; devuelve la grilla completa. */
  actualizarPreferencias: (preferencias: PreferenciaCambio[]) =>
    api<PreferenciasDeCanal[]>('/perfil/preferencias', {
      method: 'PUT',
      body: JSON.stringify({ preferencias }),
    }),

  /** Pide la contraseña actual. */
  cambiarPassword: (actual: string, nueva: string) =>
    api<void>('/perfil/password', { method: 'PUT', body: JSON.stringify({ actual, nueva }) }),

  /** Sube la foto de perfil (imagen de hasta 2 MB). Su `url` va después en `actualizar`. */
  subirAvatar: (archivo: File) => subirArchivo(archivo, 'avatares'),
};
