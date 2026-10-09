import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EstadoLiquidacion } from '@/types/expensa';
import { PASOS, pasoDe } from './etiquetas';

/** La barra de pasos de la liquidación: lo hecho con tilde, el actual resaltado. */
export function PasosLiquidacion({ estado }: { estado: EstadoLiquidacion }) {
  const actual = pasoDe(estado);
  // Emitida, el último paso también está hecho.
  const terminada = estado === 'EMITIDA' || estado === 'CERRADA';

  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {PASOS.map((nombre, i) => {
        const hecho = i < actual || (terminada && i === actual);
        const enCurso = i === actual && !terminada;
        return (
          <li
            key={nombre}
            className={cn(
              'flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm',
              enCurso && 'border-primary bg-accent text-accent-foreground',
            )}
          >
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                hecho ? 'bg-success text-primary-foreground' : enCurso ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
              )}
            >
              {hecho ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className={cn('truncate', !hecho && !enCurso && 'text-muted-foreground')}>{nombre}</span>
          </li>
        );
      })}
    </ol>
  );
}
