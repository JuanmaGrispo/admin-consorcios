import {
  Building2,
  CalendarDays,
  Landmark,
  LayoutDashboard,
  Megaphone,
  Receipt,
  Settings,
  Tags,
  Users,
  Vote,
  Wallet,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface ItemNavegacion {
  href: string;
  etiqueta: string;
  icono: LucideIcon;
}

export interface GrupoNavegacion {
  titulo: string;
  items: ItemNavegacion[];
}

/**
 * El menú del administrador, igual al de la pantalla 01 del prototipo. Todas
 * las rutas ya existen (las que faltan muestran "en construcción"), así que
 * nadie necesita tocar este archivo para sumar su pantalla.
 */
export const NAVEGACION_ADMIN: GrupoNavegacion[] = [
  {
    titulo: 'General',
    items: [{ href: '/admin', etiqueta: 'Panel general', icono: LayoutDashboard }],
  },
  {
    titulo: 'Edificio',
    items: [
      { href: '/admin/unidades', etiqueta: 'Consorcio y unidades', icono: Building2 },
      { href: '/admin/vecinos', etiqueta: 'Usuarios y vecinos', icono: Users },
      // No está en el prototipo: categorías de reclamo, proveedores y rubros de gasto.
      { href: '/admin/catalogos', etiqueta: 'Catálogos', icono: Tags },
    ],
  },
  {
    titulo: 'Expensas',
    items: [
      { href: '/admin/liquidaciones', etiqueta: 'Liquidación', icono: Receipt },
      { href: '/admin/cobranzas', etiqueta: 'Cobranzas', icono: Wallet },
    ],
  },
  {
    titulo: 'Gestión',
    items: [
      { href: '/admin/reclamos', etiqueta: 'Reclamos', icono: Wrench },
      { href: '/admin/reservas', etiqueta: 'Amenities y reservas', icono: CalendarDays },
      { href: '/admin/asambleas', etiqueta: 'Asambleas', icono: Landmark },
      { href: '/admin/votaciones', etiqueta: 'Votaciones', icono: Vote },
      { href: '/admin/novedades', etiqueta: 'Novedades', icono: Megaphone },
    ],
  },
];

export const CONFIGURACION_ADMIN: ItemNavegacion = {
  href: '/admin/configuracion',
  etiqueta: 'Configuración',
  icono: Settings,
};

/** El panel general es `/admin` a secas: no tiene que quedar activo en `/admin/reclamos`. */
export function estaActivo(href: string, pathname: string): boolean {
  return href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
}
