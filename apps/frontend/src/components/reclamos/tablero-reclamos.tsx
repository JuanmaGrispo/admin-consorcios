import { IconoCatalogo } from '@/components/catalogos/icono-catalogo';
import { EstadoBadge } from '@/components/estado-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fecha, haceCuanto } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { ESTADOS_RECLAMO, type EstadoReclamo, type Reclamo } from '@/types/reclamo';

const COLUMNAS: Record<EstadoReclamo, { titulo: string; punto: string }> = {
  NUEVO: { titulo: 'Nuevo', punto: 'bg-primary' },
  EN_CURSO: { titulo: 'En curso', punto: 'bg-warning' },
  ESPERANDO_PROVEEDOR: { titulo: 'Esperando proveedor', punto: 'bg-muted-foreground' },
  RESUELTO: { titulo: 'Resuelto', punto: 'bg-success' },
};

interface TableroReclamosProps {
  /** Los reclamos de cada columna; `undefined` mientras cargan. */
  columnas: Record<EstadoReclamo, Reclamo[]> | undefined;
  /** Los totales reales por estado (la columna puede traer sólo los más recientes). */
  totales: Record<EstadoReclamo, number> | undefined;
  seleccionado: string | null;
  onSeleccionar: (id: string) => void;
}

/** El tablero de la pantalla 04: una columna por estado, la tarjeta abre el detalle. */
export function TableroReclamos({ columnas, totales, seleccionado, onSeleccionar }: TableroReclamosProps) {
  return (
    <div className="-mx-4 grid snap-x auto-cols-[minmax(15rem,1fr)] grid-flow-col gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      {ESTADOS_RECLAMO.map((estado) => {
        const reclamos = columnas?.[estado];
        const total = totales?.[estado] ?? reclamos?.length;
        return (
          <section key={estado} className="flex snap-start flex-col gap-2" aria-label={COLUMNAS[estado].titulo}>
            <header className="flex items-center justify-between px-1">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <span className={cn('size-2 rounded-full', COLUMNAS[estado].punto)} />
                {COLUMNAS[estado].titulo}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">{total ?? ''}</span>
            </header>

            <div className="flex min-h-32 flex-1 flex-col gap-2 rounded-xl border bg-muted p-2">
              {!reclamos &&
                Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg bg-card" />)}

              {reclamos?.length === 0 && (
                <p className="px-2 py-6 text-center text-xs text-muted-foreground">Sin reclamos</p>
              )}

              {reclamos?.map((reclamo) => (
                <TarjetaTablero
                  key={reclamo.id}
                  reclamo={reclamo}
                  activa={reclamo.id === seleccionado}
                  onClick={() => onSeleccionar(reclamo.id)}
                />
              ))}

              {reclamos && total !== undefined && total > reclamos.length && (
                <p className="px-2 py-1 text-center text-xs text-muted-foreground">
                  Y {total - reclamos.length} más en la vista de lista
                </p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function TarjetaTablero({ reclamo, activa, onClick }: { reclamo: Reclamo; activa: boolean; onClick: () => void }) {
  const cuando =
    reclamo.estado === 'RESUELTO' && reclamo.cerradoAt
      ? `cerrado ${fecha(reclamo.cerradoAt).slice(0, 5)}`
      : haceCuanto(reclamo.createdAt);

  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      aria-pressed={activa}
      className={cn(
        'h-auto flex-col items-stretch gap-1.5 bg-card p-3 text-left font-normal whitespace-normal hover:border-primary/50 hover:bg-card',
        activa && 'border-primary ring-1 ring-primary',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold">{reclamo.unidad.etiqueta}</span>
        <EstadoBadge dominio="prioridad" estado={reclamo.prioridad} />
      </div>
      <span className="line-clamp-2 text-sm font-medium">{reclamo.descripcion}</span>
      <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1">
          <IconoCatalogo nombre={reclamo.categoria?.icono} className="size-3.5" />
          <span className="truncate">{reclamo.categoria?.nombre}</span>
        </span>
        <span className="shrink-0">{cuando}</span>
      </span>
    </Button>
  );
}
