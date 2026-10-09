import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { EstadoBadge } from '@/components/estado-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { fecha, fechaDeInstante, pesos, periodo } from '@/lib/formato';
import type { FilaCobranza } from '@/types/expensa';

/** Un período en "Mis expensas" (pantalla 11): cuánto fue, si se pagó y cuándo. */
export function FilaBoletaVecino({ fila }: { fila: FilaCobranza }) {
  const detalle =
    fila.estado === 'PAGADA' && fila.ultimoPago
      ? `Pagado el ${fechaDeInstante(fila.ultimoPago.fecha)}`
      : fila.estado === 'PARCIAL'
        ? `Pagaste ${pesos(fila.pagado)} · vence ${fecha(fila.fechaVencimiento)}`
        : `Vence ${fecha(fila.fechaVencimiento)}`;

  return (
    <Link
      href={`/vecino/expensas/${fila.id}`}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted"
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium">{periodo(fila.periodo)}</p>
        <p className="text-sm text-muted-foreground tabular-nums">{detalle}</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="font-semibold tabular-nums">{pesos(fila.emitido)}</span>
        <EstadoBadge dominio="boleta" estado={fila.estado}>
          {fila.estado === 'PENDIENTE' ? 'Por vencer' : undefined}
        </EstadoBadge>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

export function FilaBoletaVecinoEsqueleto() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-36" />
      </div>
      <Skeleton className="h-5 w-20" />
    </div>
  );
}
