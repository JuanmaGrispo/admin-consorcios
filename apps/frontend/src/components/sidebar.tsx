'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSesion } from './session';

const NAV = [
  {
    href: '/',
    label: 'Consorcios',
    icono: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 21h18M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M9 8h2M9 12h2M9 16h2" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { usuario, cerrarSesion } = useSesion();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
        <div className="h-7 w-7 rounded-lg bg-accent" />
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-tight">Domus</div>
          <div className="text-[11px] font-medium tracking-wide text-muted uppercase">
            Plataforma
          </div>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5 px-3 py-2">
        {NAV.map((item) => {
          const activo =
            item.href === '/'
              ? pathname === '/' || pathname.startsWith('/consorcios')
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                activo
                  ? 'bg-accent-soft text-accent'
                  : 'text-ink-2 hover:bg-surface-2'
              }`}
            >
              {item.icono}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-line-2 px-5 py-4">
        <div className="text-sm font-medium">
          {usuario.nombre} {usuario.apellido}
        </div>
        <div className="mt-0.5 text-xs text-muted">Superadmin</div>
        <button
          onClick={cerrarSesion}
          className="mt-3 text-xs font-medium text-muted underline-offset-2 hover:text-ink hover:underline"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
