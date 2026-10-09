import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PaginacionProps {
  /** Lo que devuelve el backend en `Paginado<T>`. */
  pagina: number;
  paginas: number;
  total: number;
  /** Cuántos hay en la página actual: "Mostrando 20 de 48". */
  mostrando: number;
  /** El plural de lo que se lista: "novedades", "unidades". */
  sustantivo: string;
  onCambiar: (pagina: number) => void;
}

/** Hasta 7 páginas se muestran todas; con más, la primera, la última y las vecinas. */
function numeros(pagina: number, paginas: number): (number | '…')[] {
  if (paginas <= 7) return Array.from({ length: paginas }, (_, i) => i + 1);
  const vecinas = [pagina - 1, pagina, pagina + 1].filter((p) => p > 1 && p < paginas);
  return [
    1,
    ...(vecinas[0] > 2 ? (['…'] as const) : []),
    ...vecinas,
    ...(vecinas[vecinas.length - 1] < paginas - 1 ? (['…'] as const) : []),
    paginas,
  ];
}

/**
 * El pie de una tabla (pantalla 02 del prototipo): cuántos se ven de cuántos y
 * los números de página. Va adentro de la `Card` de la tabla, debajo de ella.
 */
export function Paginacion({ pagina, paginas, total, mostrando, sustantivo, onCambiar }: PaginacionProps) {
  return (
    <nav
      aria-label="Paginación"
      className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground"
    >
      <span className="tabular-nums">
        Mostrando {mostrando} de {total} {sustantivo}
      </span>
      {paginas > 1 && (
        <div className="flex gap-1.5">
          {numeros(pagina, paginas).map((n, i) =>
            n === '…' ? (
              <span key={`hueco-${i}`} className="flex size-8 items-center justify-center">
                …
              </span>
            ) : (
              <Button
                key={n}
                variant="outline"
                size="icon"
                aria-current={n === pagina ? 'page' : undefined}
                onClick={() => n !== pagina && onCambiar(n)}
                className={cn(
                  'tabular-nums',
                  n === pagina && 'bg-accent font-semibold text-accent-foreground hover:bg-accent',
                )}
              >
                {n}
              </Button>
            ),
          )}
        </div>
      )}
    </nav>
  );
}
