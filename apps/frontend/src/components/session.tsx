'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { inicioDe } from '@/lib/roles';
import { authService } from '@/services/auth';
import type { RolUsuario, Usuario } from '@/types/usuario';

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

interface SesionProviderProps {
  /** Los roles que pueden ver este portal. Otro rol se va a su propio inicio. */
  roles: RolUsuario[];
  /** Lo que se ve mientras se valida la sesión: el esqueleto del portal. */
  esqueleto?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Valida la sesión contra el backend al montar. El proxy ya chequeó que la
 * cookie exista; acá se valida de verdad (firma, expiración, usuario activo)
 * y se decide si el rol puede ver este portal. Un rol equivocado no ve un
 * "sin acceso": se lo manda a su portal, que es lo que vino a buscar.
 */
export function SesionProvider({ roles, esqueleto, children }: SesionProviderProps) {
  const router = useRouter();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  // `roles` llega como un array literal nuevo en cada render del layout: el
  // efecto depende del texto, no de la referencia, para no revalidar de más.
  const permitidos = roles.join(',');

  useEffect(() => {
    let cancelado = false;
    authService
      .me()
      .then((u) => {
        if (cancelado) return;
        if (permitidos.split(',').includes(u.rol)) setUsuario(u);
        else router.replace(inicioDe(u.rol));
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
  }, [router, permitidos]);

  const cerrarSesion = useCallback(async () => {
    await authService.logout();
    router.replace('/login');
    router.refresh();
  }, [router]);

  if (!usuario) return esqueleto ?? <EsqueletoPanel />;

  return (
    <SesionContext.Provider value={{ usuario, cerrarSesion }}>{children}</SesionContext.Provider>
  );
}

/** El esqueleto de un portal con sidebar (superadmin y administrador). */
export function EsqueletoPanel() {
  return (
    <div className="flex min-h-screen">
      <div className="hidden w-64 border-r p-4 md:block">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="mt-8 h-8 w-full" />
        <Skeleton className="mt-2 h-8 w-full" />
        <Skeleton className="mt-2 h-8 w-full" />
      </div>
      <div className="flex-1 p-6 lg:p-8">
        <Skeleton className="h-8 w-48" />
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="mt-6 h-64" />
      </div>
    </div>
  );
}
