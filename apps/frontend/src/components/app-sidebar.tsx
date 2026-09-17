'use client';

import { Building2, LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import { useSesion } from './session';

const NAV = [{ href: '/', label: 'Consorcios', icono: Building2 }];

export function AppSidebar() {
  const pathname = usePathname();
  const { usuario, cerrarSesion } = useSesion();
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar>
      <SidebarHeader className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="size-7 rounded-lg bg-primary" />
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-tight">Domus</div>
            <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Plataforma
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Gestión</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => {
                const activo =
                  item.href === '/'
                    ? pathname === '/' || pathname.startsWith('/consorcios')
                    : pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={activo}
                      // En mobile la sidebar es un Sheet: navegar lo cierra.
                      onClick={() => setOpenMobile(false)}
                    >
                      <Link href={item.href}>
                        <item.icono />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="px-4 py-4">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">
            {usuario.nombre} {usuario.apellido}
          </div>
          <div className="truncate text-xs text-muted-foreground">{usuario.email}</div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={cerrarSesion}
          className="mt-1 w-full justify-start text-muted-foreground"
        >
          <LogOut />
          Cerrar sesión
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
