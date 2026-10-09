import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface PageHeaderProps {
  titulo: string;
  /** La línea gris de abajo: "Período agosto 2026 · 48 unidades". */
  descripcion?: React.ReactNode;
  /** La etiqueta en mayúsculas de arriba ("Av. Rivadavia 4820 · Almagro"). */
  contexto?: React.ReactNode;
  /** Botones de la derecha. En mobile bajan de línea solos. */
  acciones?: React.ReactNode;
  /** Si viene, muestra una flecha para volver (pantallas internas del vecino). */
  volverA?: string;
}

/** El encabezado de todas las pantallas: título, contexto y acciones. */
export function PageHeader({ titulo, descripcion, contexto, acciones, volverA }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2">
        {volverA && (
          <Button asChild variant="ghost" size="icon" className="-ml-2 shrink-0">
            <Link href={volverA} aria-label="Volver">
              <ArrowLeft />
            </Link>
          </Button>
        )}
        <div className="min-w-0">
          {contexto && (
            <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              {contexto}
            </p>
          )}
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{titulo}</h1>
          {descripcion && <p className="mt-1 text-sm text-muted-foreground">{descripcion}</p>}
        </div>
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </header>
  );
}
