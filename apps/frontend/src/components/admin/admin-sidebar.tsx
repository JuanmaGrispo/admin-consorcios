'use client';

import { Check, ChevronsUpDown, LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSesion } from '@/components/session';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import { iniciales } from '@/lib/formato';
import { reclamosService } from '@/services/reclamos';
import type { Consorcio } from '@/types/consorcio';
import { useConsorcioActivo } from './consorcio-activo';
import { CONFIGURACION_ADMIN, estaActivo, NAVEGACION_ADMIN, type ItemNavegacion } from './navegacion';

function subtitulo(c: Consorcio): string {
  const unidades = c.cantidadUnidades !== undefined ? `${c.cantidadUnidades} unidades` : null;
  return [c.barrio, unidades].filter(Boolean).join(' · ');
}

/** El menú del administrador: selector de consorcio, navegación y su cuenta. */
export function AdminSidebar() {
  const pathname = usePathname();
  const { usuario, cerrarSesion } = useSesion();
  const { consorcios, consorcio, cambiar } = useConsorcioActivo();
  const { setOpenMobile } = useSidebar();
  const contadores = useContadores(consorcio.id);

  const item = ({ href, etiqueta, icono: Icono }: ItemNavegacion) => (
    <SidebarMenuItem key={href}>
      <SidebarMenuButton
        asChild
        isActive={estaActivo(href, pathname)}
        // En mobile la sidebar es un Sheet: navegar lo cierra.
        onClick={() => setOpenMobile(false)}
      >
        <Link href={href}>
          <Icono />
          <span>{etiqueta}</span>
        </Link>
      </SidebarMenuButton>
      {contadores[href] ? <SidebarMenuBadge>{contadores[href]}</SidebarMenuBadge> : null}
    </SidebarMenuItem>
  );

  return (
    <Sidebar>
      <SidebarHeader className="gap-3 px-3 pt-4 pb-2">
        <div className="flex items-center gap-2.5 px-1">
          <div className="size-7 rounded-lg bg-primary" />
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-tight">Domus</div>
            <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Administración
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="border bg-card">
              <div className="min-w-0 flex-1 text-left leading-tight">
                <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  Consorcio activo
                </div>
                <div className="truncate text-sm font-semibold">{consorcio.nombre}</div>
                <div className="truncate text-xs text-muted-foreground">{subtitulo(consorcio)}</div>
              </div>
              <ChevronsUpDown className="ml-auto text-muted-foreground" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width)">
            <DropdownMenuLabel>Tus consorcios</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {consorcios.map((c) => (
              <DropdownMenuItem key={c.id} onSelect={() => cambiar(c.id)}>
                <div className="min-w-0 flex-1">
                  <div className="truncate">{c.nombre}</div>
                  <div className="truncate text-xs text-muted-foreground">{subtitulo(c)}</div>
                </div>
                {c.id === consorcio.id && <Check />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>

      <SidebarContent>
        {NAVEGACION_ADMIN.map((grupo) => (
          <SidebarGroup key={grupo.titulo}>
            <SidebarGroupLabel>{grupo.titulo}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{grupo.items.map(item)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>{item(CONFIGURACION_ADMIN)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="px-3 py-3">
        <div className="flex items-center gap-2.5 px-1">
          <Avatar className="size-8">
            <AvatarFallback className="bg-accent text-xs font-semibold text-accent-foreground">
              {iniciales(usuario.nombre, usuario.apellido)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-medium">
              {usuario.nombre} {usuario.apellido}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {usuario.rol === 'SUPER_ADMIN' ? 'Plataforma' : 'Administración'} · {consorcios.length}{' '}
              {consorcios.length === 1 ? 'edificio' : 'edificios'}
            </div>
          </div>
          <SidebarMenuButton
            onClick={cerrarSesion}
            tooltip="Cerrar sesión"
            className="size-8 shrink-0 justify-center p-0 text-muted-foreground"
            aria-label="Cerrar sesión"
          >
            <LogOut />
          </SidebarMenuButton>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

/**
 * Los números del menú (reclamos abiertos del consorcio). Si falla, el menú
 * sigue sin números: no es motivo para romper la navegación.
 */
function useContadores(consorcioId: string): Record<string, number> {
  const [contadores, setContadores] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelado = false;
    reclamosService
      .resumen(consorcioId)
      .then((r) => !cancelado && setContadores({ '/admin/reclamos': r.abiertos }))
      .catch(() => !cancelado && setContadores({}));
    return () => {
      cancelado = true;
    };
  }, [consorcioId]);

  return contadores;
}
