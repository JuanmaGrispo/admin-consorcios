'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { authService } from '@/services/auth';
import type { Usuario } from '@/types/usuario';

interface Sesion {
  usuario: Usuario;
  cerrarSesion: () => Promise<void>;
}

const SesionContext = createContext<Sesion | null>(null);

export function useSesion(): Sesion {
  const sesion = useContext(SesionContext);
  if (!sesion) throw new Error('useSesion solo funciona adentro de <SesionProvider>');
  return sesion;
}

/**
 * Valida la sesión contra el backend al montar. El proxy ya chequeó que la
 * cookie exista; acá se valida de verdad (firma, expiración, usuario activo)
 * y se decide qué puede ver: este panel es SOLO para el superadmin.
 */
export function SesionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [estado, setEstado] = useState<'cargando' | 'sin-permiso' | 'ok'>('cargando');

  useEffect(() => {
    let cancelado = false;
    authService
      .me()
      .then((u) => {
        if (cancelado) return;
        if (u.rol !== 'SUPER_ADMIN') {
          setUsuario(u);
          setEstado('sin-permiso');
        } else {
          setUsuario(u);
          setEstado('ok');
        }
      })
      .catch(() => {
        // Cookie vencida o inválida: el backend dijo 401, de vuelta al login.
        if (!cancelado) {
          authService.logout().finally(() => {
            router.replace('/login');
            router.refresh();
          });
        }
      });
    return () => {
      cancelado = true;
    };
  }, [router]);

  const cerrarSesion = useCallback(async () => {
    await authService.logout();
    router.replace('/login');
    router.refresh();
  }, [router]);

  if (estado === 'cargando') {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted">
        Cargando…
      </div>
    );
  }

  if (estado === 'sin-permiso') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="rounded-xl border border-line bg-surface p-8 shadow-card">
          <h1 className="text-lg font-semibold">Sin acceso</h1>
          <p className="mt-2 max-w-sm text-sm text-muted">
            Este panel es exclusivo del administrador de la plataforma. Tu
            cuenta ({usuario?.email}) no tiene ese rol.
          </p>
          <button
            onClick={cerrarSesion}
            className="mt-6 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <SesionContext.Provider value={{ usuario: usuario!, cerrarSesion }}>
      {children}
    </SesionContext.Provider>
  );
}
