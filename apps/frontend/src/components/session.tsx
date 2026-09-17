'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
      <div className="flex min-h-screen">
        <div className="hidden w-64 border-r p-4 md:block">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="mt-8 h-8 w-full" />
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

  if (estado === 'sin-permiso') {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Sin acceso</CardTitle>
            <CardDescription>
              Este panel es exclusivo del administrador de la plataforma. Tu
              cuenta ({usuario?.email}) no tiene ese rol.
            </CardDescription>
          </CardHeader>
          <CardContent />
          <CardFooter>
            <Button onClick={cerrarSesion} className="w-full">
              Cerrar sesión
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <SesionContext.Provider value={{ usuario: usuario!, cerrarSesion }}>
      {children}
    </SesionContext.Provider>
  );
}
