import { EstadoBadge } from '@/components/estado-badge';
import { Progress } from '@/components/ui/progress';
import { porcentaje } from '@/lib/formato';
import type { Escrutinio } from '@/types/votacion';

interface EscrutinioBarrasProps {
  escrutinio: Escrutinio;
  /** Con el resultado a la vista sólo cuando la votación ya cerró. */
  cerrada: boolean;
}

/** El conteo de una votación: una barra por opción, la participación y, cerrada, el resultado. */
export function EscrutinioBarras({ escrutinio, cerrada }: EscrutinioBarrasProps) {
  return (
    <div className="flex flex-col gap-3">
      {escrutinio.opciones.map((o) => (
        <div key={o.opcionId} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-medium">{o.etiqueta}</span>
            <span className="text-muted-foreground tabular-nums">
              {porcentaje(o.porcentaje)} · {o.votos} {o.votos === 1 ? 'voto' : 'votos'}
            </span>
          </div>
          <Progress value={o.porcentaje} className="h-2" />
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
        <span className="text-muted-foreground">
          Participación <span className="font-medium text-foreground tabular-nums">{porcentaje(escrutinio.participacion)}</span>
        </span>
        {cerrada ? (
          <EstadoBadge dominio="resultado" estado={escrutinio.resultado} />
        ) : (
          <span className="text-xs text-muted-foreground">Parcial: puede cambiar hasta el cierre</span>
        )}
      </div>
    </div>
  );
}
