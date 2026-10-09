'use client';

import { CalendarDays, Home, Receipt, UserRound, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface ItemNavegacion {
  href: string;
  etiqueta: string;
  icono: LucideIcon;
}

/**
 * La barra de abajo del portal vecino (pantallas 10 a 16 del prototipo).
 * Asambleas, novedades y notificaciones se abren desde el inicio y el perfil:
 * en el celular no entran más de cinco botones.
 */
export const NAVEGACION_VECINO: ItemNavegacion[] = [
  { href: '/vecino', etiqueta: 'Inicio', icono: Home },
  { href: '/vecino/expensas', etiqueta: 'Expensas', icono: Receipt },
  { href: '/vecino/reclamos', etiqueta: 'Reclamos', icono: Wrench },
  { href: '/vecino/reservas', etiqueta: 'Reservas', icono: CalendarDays },
  { href: '/vecino/perfil', etiqueta: 'Perfil', icono: UserRound },
];

function estaActivo(href: string, pathname: string): boolean {
  return href === '/vecino' ? pathname === '/vecino' : pathname.startsWith(href);
}

export function NavegacionVecino() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {NAVEGACION_VECINO.map(({ href, etiqueta, icono: Icono }) => {
          const activo = estaActivo(href, pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={activo ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                  activo ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icono className="size-5" />
                {etiqueta}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
