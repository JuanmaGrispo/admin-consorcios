'use client';

import { Bell, Check, ChevronDown, LogOut } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useNoLeidas } from '@/components/notificaciones/use-no-leidas';
import { Badge } from '@/components/ui/badge';
import { useSesion } from '@/components/session';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { domicilio } from '@/lib/formato';
import { useUnidadActiva } from './unidad-activa';

/**
 * La barra de arriba del vecino: en qué unidad está (con selector si tiene
 * más de una) y la campana con los avisos sin leer.
 */
export function BarraVecino() {
  const { unidades, unidad, consorcio, cambiar } = useUnidadActiva();
  const { cerrarSesion } = useSesion();
  const noLeidas = useNoLeidas();
  const edificio = domicilio(consorcio.calle, consorcio.numero) || consorcio.nombre;

  const etiqueta = (
    <span className="min-w-0 truncate text-sm">
      <span className="font-semibold">{edificio}</span>
      <span className="text-muted-foreground"> · Unidad {unidad.etiqueta}</span>
    </span>
  );

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-md items-center gap-2 px-4">
        <Image src="/logo-domus.png" alt="" width={24} height={24} className="shrink-0" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="min-w-0 flex-1 justify-start px-2">
                {etiqueta}
                <ChevronDown className="ml-auto text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>{unidades.length > 1 ? 'Tus unidades' : 'Tu unidad'}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {unidades.map((u) => (
                <DropdownMenuItem key={u.id} onSelect={() => cambiar(u.id)}>
                  Unidad {u.etiqueta}
                  {u.id === unidad.id && <Check className="ml-auto" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void cerrarSesion()}>
                <LogOut />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

        <Button asChild variant="ghost" size="icon" className="relative shrink-0">
          <Link href="/vecino/notificaciones" aria-label={`Notificaciones (${noLeidas} sin leer)`}>
            <Bell />
            {noLeidas > 0 && (
              <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px] tabular-nums">
                {noLeidas > 9 ? '9+' : noLeidas}
              </Badge>
            )}
          </Link>
        </Button>
      </div>
    </header>
  );
}
