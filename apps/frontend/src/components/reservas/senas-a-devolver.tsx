'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { pesos } from '@/lib/formato';
import type { EstadoReserva, Reserva } from '@/types/reserva';
import { diaMes, fechaDe } from './tiempo';

/** Lo mismo que `SENA_DEVOLVIBLE` del backend: terminada, la seña ya no reserva nada. */
export const SENA_DEVOLVIBLE: EstadoReserva[] = ['FINALIZADA', 'CANCELADA', 'RECHAZADA'];

const POR_QUE: Partial<Record<EstadoReserva, string>> = {
  FINALIZADA: 'terminó',
  CANCELADA: 'cancelada',
  RECHAZADA: 'rechazada',
};

/** Una reserva con seña pagada que ya terminó y todavía no se devolvió. */
export function debeSena(r: Reserva): boolean {
  return SENA_DEVOLVIBLE.includes(r.estado) && !!r.sena?.pagada && !r.sena.devueltaAt;
}

/**
 * Las señas que hay que devolver (pantalla 05): de reservas terminadas,
 * canceladas o rechazadas. Marcarla le avisa al vecino.
 */
export function SenasADevolver({
  reservas,
  onDevuelta,
}: {
  /** Null mientras cargan. */
  reservas: Reserva[] | null;
  onDevuelta: (r: Reserva) => void;
}) {
  // Sin nada que devolver, la tarjeta no ocupa lugar.
  if (reservas?.length === 0) return null;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm">Señas a devolver</CardTitle>
        {reservas && (
          <CardDescription>
            {reservas.length} · {pesos(reservas.reduce((total, r) => total + (r.sena?.monto ?? 0), 0))}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {!reservas ? (
          <Skeleton className="h-16 rounded-lg" />
        ) : (
          reservas.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-lg border p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {r.unidad.etiqueta} · {pesos(r.sena?.monto ?? 0)}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.amenity.nombre} del {diaMes(fechaDe(r.inicio))} · {POR_QUE[r.estado]}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => onDevuelta(r)}>
                Devuelta
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
