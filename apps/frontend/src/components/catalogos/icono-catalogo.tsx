import {
  ArrowUpDown,
  Bike,
  Building2,
  Car,
  Droplets,
  Flame,
  Hammer,
  Landmark,
  Leaf,
  Lightbulb,
  Lock,
  Paintbrush,
  ReceiptText,
  ShieldCheck,
  SprayCan,
  Tag,
  Trash2,
  UserRound,
  Volume2,
  Wifi,
  Wrench,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { createElement } from 'react';
import { cn } from '@/lib/utils';

/**
 * El backend guarda el ícono de categorías y rubros con el nombre de Material
 * Symbols (el del prototipo: "plumbing", "elevator"); el front dibuja con
 * Lucide. Esta tabla es la traducción, y también la lista que ofrece el
 * selector del alta, así que todo lo que se elige ahí se puede dibujar.
 */
export const ICONOS_CATALOGO: { valor: string; etiqueta: string; icono: LucideIcon }[] = [
  { valor: 'plumbing', etiqueta: 'Plomería', icono: Droplets },
  { valor: 'elevator', etiqueta: 'Ascensor', icono: ArrowUpDown },
  { valor: 'bolt', etiqueta: 'Electricidad', icono: Zap },
  { valor: 'lightbulb', etiqueta: 'Iluminación', icono: Lightbulb },
  { valor: 'cleaning_services', etiqueta: 'Limpieza', icono: SprayCan },
  { valor: 'volume_up', etiqueta: 'Ruidos', icono: Volume2 },
  { valor: 'lock', etiqueta: 'Cerrajería', icono: Lock },
  { valor: 'local_fire_department', etiqueta: 'Gas', icono: Flame },
  { valor: 'format_paint', etiqueta: 'Pintura', icono: Paintbrush },
  { valor: 'pedal_bike', etiqueta: 'Espacios comunes', icono: Bike },
  { valor: 'garage', etiqueta: 'Cocheras', icono: Car },
  { valor: 'delete', etiqueta: 'Residuos', icono: Trash2 },
  { valor: 'yard', etiqueta: 'Jardín', icono: Leaf },
  { valor: 'wifi', etiqueta: 'Internet', icono: Wifi },
  { valor: 'security', etiqueta: 'Seguridad', icono: ShieldCheck },
  { valor: 'badge', etiqueta: 'Personal', icono: UserRound },
  { valor: 'apartment', etiqueta: 'Edificio', icono: Building2 },
  { valor: 'account_balance', etiqueta: 'Administración', icono: Landmark },
  { valor: 'receipt_long', etiqueta: 'Servicios', icono: ReceiptText },
  { valor: 'build', etiqueta: 'Mantenimiento', icono: Wrench },
  { valor: 'handyman', etiqueta: 'Reparaciones', icono: Hammer },
];

const POR_NOMBRE = new Map(ICONOS_CATALOGO.map((i) => [i.valor, i.icono]));

/** Un nombre desconocido o vacío se dibuja con una etiqueta genérica: nunca rompe la pantalla. */
export function iconoDeCatalogo(nombre: string | null | undefined): LucideIcon {
  return (nombre && POR_NOMBRE.get(nombre)) || Tag;
}

export function IconoCatalogo({ nombre, className }: { nombre: string | null | undefined; className?: string }) {
  // createElement y no <Icono />: son componentes estáticos de Lucide elegidos de la tabla, no
  // componentes creados en el render, pero el lint no puede distinguirlo en JSX.
  return createElement(iconoDeCatalogo(nombre), {
    className: cn('size-4 shrink-0', className),
    'aria-hidden': true,
  });
}
