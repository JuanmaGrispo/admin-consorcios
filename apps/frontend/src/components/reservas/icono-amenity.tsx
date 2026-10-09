import { Armchair, Bike, Car, Dumbbell, Flame, PartyPopper, Sofa, Trees, Waves } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { createElement } from 'react';
import { cn } from '@/lib/utils';

/**
 * El backend guarda el ícono del amenity con el nombre de Material Symbols del
 * prototipo ("deck", "outdoor_grill"); el front dibuja con Lucide. Esta tabla
 * traduce y es también la lista que ofrece el formulario del amenity.
 */
export const ICONOS_AMENITY: { valor: string; etiqueta: string; icono: LucideIcon }[] = [
  { valor: 'deck', etiqueta: 'SUM', icono: Sofa },
  { valor: 'outdoor_grill', etiqueta: 'Parrilla', icono: Flame },
  { valor: 'local_parking', etiqueta: 'Cochera', icono: Car },
  { valor: 'pool', etiqueta: 'Pileta', icono: Waves },
  { valor: 'fitness_center', etiqueta: 'Gimnasio', icono: Dumbbell },
  { valor: 'celebration', etiqueta: 'Salón de fiestas', icono: PartyPopper },
  { valor: 'park', etiqueta: 'Jardín', icono: Trees },
  { valor: 'pedal_bike', etiqueta: 'Bicicletero', icono: Bike },
];

const POR_NOMBRE = new Map(ICONOS_AMENITY.map((i) => [i.valor, i.icono]));

/** Sin ícono cargado (los amenities viejos), se adivina por el nombre: "SUM", "Parrilla terraza". */
const POR_PALABRA: [RegExp, string][] = [
  [/\bsum\b|sal[oó]n/i, 'deck'],
  [/parrill|asador/i, 'outdoor_grill'],
  [/cochera|estacionamiento/i, 'local_parking'],
  [/pileta|piscina/i, 'pool'],
  [/gimnasio|gym/i, 'fitness_center'],
  [/jard[ií]n|terraza|patio/i, 'park'],
  [/bici/i, 'pedal_bike'],
];

/** El ícono cargado o, si no hay, el que sugiere el nombre. Undefined si no se parece a nada. */
export function iconoSugerido(amenity: { icono: string | null; nombre: string }): string | undefined {
  return amenity.icono ?? POR_PALABRA.find(([patron]) => patron.test(amenity.nombre))?.[1];
}

/** El ícono de un amenity: el cargado, uno deducido del nombre o un sillón genérico. Nunca rompe la pantalla. */
export function IconoAmenity({
  amenity,
  className,
}: {
  amenity: { icono: string | null; nombre: string };
  className?: string;
}) {
  const nombre = iconoSugerido(amenity);
  // createElement y no <Icono />: son componentes estáticos elegidos de la tabla,
  // pero el lint no lo distingue en JSX (mismo criterio que IconoCatalogo).
  return createElement((nombre && POR_NOMBRE.get(nombre)) || Armchair, {
    className: cn('size-4 shrink-0', className),
    'aria-hidden': true,
  });
}
