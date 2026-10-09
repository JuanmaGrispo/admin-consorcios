'use client';

import { Bell, ChevronRight, Landmark, LogOut, Megaphone } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { CambiarPassword } from '@/components/perfil/cambiar-password';
import { DatosPerfil } from '@/components/perfil/datos-perfil';
import { PreferenciasAviso } from '@/components/perfil/preferencias-aviso';
import { useSesion } from '@/components/session';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TIPOS_UNIDAD } from '@/components/unidades/etiquetas';
import { useUnidadActiva } from '@/components/vecino/unidad-activa';
import { usePedido } from '@/hooks/use-pedido';
import { porcentaje } from '@/lib/formato';
import { perfilService } from '@/services/perfil';

/** Lo que no está en la barra de abajo se abre desde acá. */
const ACCESOS = [
  { href: '/vecino/asambleas', etiqueta: 'Asambleas y votaciones', icono: Landmark },
  { href: '/vecino/novedades', etiqueta: 'Novedades del edificio', icono: Megaphone },
  { href: '/vecino/notificaciones', etiqueta: 'Mis avisos', icono: Bell },
];

/** Perfil y preferencias de aviso del vecino (pantalla 16). */
export default function VecinoPerfilPage() {
  const { cerrarSesion } = useSesion();
  const { unidades, unidad: activa } = useUnidadActiva();
  const pedido = usePedido('perfil', () => perfilService.obtener(), 'No se pudo cargar tu perfil.');
  const perfil = pedido.datos ?? pedido.ultimo;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader titulo="Perfil" volverA="/vecino" />

      {pedido.error ? (
        <Alert variant="destructive">
          <AlertDescription>{pedido.error}</AlertDescription>
        </Alert>
      ) : !perfil ? (
        <Skeleton className="h-72 w-full" />
      ) : (
        // Se remonta con cada versión guardada: el formulario arranca con lo que quedó.
        <DatosPerfil
          key={`${perfil.nombre}|${perfil.apellido}|${perfil.telefono}|${perfil.avatarUrl}`}
          perfil={perfil}
          onGuardado={pedido.recargar}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>{unidades.length === 1 ? 'Tu unidad' : 'Tus unidades'}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y">
            {unidades.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div>
                  <p className="font-medium">
                    {u.etiqueta}
                    {u.id === activa.id && unidades.length > 1 && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">(la que estás viendo)</span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">{TIPOS_UNIDAD[u.tipo]}</p>
                </div>
                <span className="text-sm text-secondary-foreground tabular-nums">
                  Coef. {porcentaje(u.coeficiente, 4)}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="py-2">
        <CardContent className="px-2">
          <ul className="flex flex-col">
            {ACCESOS.map(({ href, etiqueta, icono: Icono }) => (
              <li key={href}>
                <Button asChild variant="ghost" className="h-11 w-full justify-start gap-3 px-3">
                  <Link href={href}>
                    <Icono className="text-muted-foreground" />
                    <span className="flex-1 text-left">{etiqueta}</span>
                    <ChevronRight className="text-muted-foreground" />
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <PreferenciasAviso />

      <CambiarPassword />

      <Button variant="outline" className="text-destructive" onClick={() => void cerrarSesion()}>
        <LogOut data-icon="inline-start" />
        Cerrar sesión
      </Button>
    </div>
  );
}
