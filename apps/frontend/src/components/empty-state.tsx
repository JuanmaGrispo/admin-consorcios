import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface EmptyStateProps {
  icono: LucideIcon;
  titulo: string;
  descripcion?: string;
  /** Un botón para salir del vacío: "Crear un reclamo". */
  accion?: React.ReactNode;
}

/**
 * Lo que se muestra cuando una lista no tiene nada ("No tenés reclamos"). Un
 * vacío explicado le dice al usuario qué hacer; una tabla sin filas, no.
 */
export function EmptyState({ icono: Icono, titulo, descripcion, accion }: EmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Icono className="size-6" />
        </div>
        <div className="max-w-sm">
          <p className="font-semibold">{titulo}</p>
          {descripcion && <p className="mt-1 text-sm text-muted-foreground">{descripcion}</p>}
        </div>
        {accion}
      </CardContent>
    </Card>
  );
}
