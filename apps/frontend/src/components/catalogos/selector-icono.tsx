import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IconoCatalogo, ICONOS_CATALOGO } from './icono-catalogo';

const SIN_ICONO = 'sin-icono';

interface SelectorIconoProps {
  id: string;
  /** Nombre de Material Symbols, o '' para ninguno. */
  valor: string;
  onChange: (valor: string) => void;
}

/** El ícono de una categoría o un rubro: sólo los que el front sabe dibujar. */
export function SelectorIcono({ id, valor, onChange }: SelectorIconoProps) {
  // Un ícono cargado por otro medio que no está en la tabla se sigue ofreciendo, para no perderlo al editar.
  const desconocido = valor && !ICONOS_CATALOGO.some((i) => i.valor === valor);
  return (
    <Select value={valor || SIN_ICONO} onValueChange={(v) => onChange(v === SIN_ICONO ? '' : v)}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={SIN_ICONO}>
          <IconoCatalogo nombre={null} className="text-muted-foreground" />
          Sin ícono
        </SelectItem>
        {desconocido && (
          <SelectItem value={valor}>
            <IconoCatalogo nombre={valor} />
            {valor}
          </SelectItem>
        )}
        {ICONOS_CATALOGO.map((i) => (
          <SelectItem key={i.valor} value={i.valor}>
            <IconoCatalogo nombre={i.valor} />
            {i.etiqueta}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
