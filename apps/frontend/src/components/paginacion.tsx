import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaginacionProps {
  /** Lo que devuelve el backend en `Paginado<T>`. */
  pagina: number;
  paginas: number;
  total: number;
  onCambiar: (pagina: number) => void;
  /** Mientras se pide la página siguiente, para no pedirla dos veces. */
  deshabilitada?: boolean;
}

/**
 * Anterior / siguiente al pie de un listado paginado. Con una sola página no
 * se muestra: no hay a dónde ir.
 */
export function Paginacion({ pagina, paginas, total, onCambiar, deshabilitada }: PaginacionProps) {
  if (paginas <= 1) return null;
  return (
    <nav aria-label="Paginación" className="flex items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground tabular-nums">
        Página {pagina} de {paginas} · {total} en total
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={deshabilitada || pagina <= 1}
          onClick={() => onCambiar(pagina - 1)}
        >
          <ChevronLeft data-icon="inline-start" />
          Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={deshabilitada || pagina >= paginas}
          onClick={() => onCambiar(pagina + 1)}
        >
          Siguiente
          <ChevronRight data-icon="inline-end" />
        </Button>
      </div>
    </nav>
  );
}
