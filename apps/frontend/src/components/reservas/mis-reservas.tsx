'use client';

import { CalendarX } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { EstadoBadge } from '@/components/estado-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { pesos } from '@/lib/formato';
import type { Reserva } from '@/types/reserva';
import { IconoAmenity } from './icono-amenity';
import { cuando, fechaCorta, fechaDe, horaDe } from './tiempo';

const EN_PIE = ['PENDIENTE', 'APROBADA'];

/** La seña está por pagar: se ofrece pagarla mientras la reserva sigue en pie. */
const senaPendiente = (r: Reserva) => !!r.sena && !r.sena.pagada && EN_PIE.includes(r.estado);

/** La línea gris de la tarjeta: lo que el vecino tiene que saber de esa reserva. */
function detalle(r: Reserva): string | null {
  if (r.estado === 'RECHAZADA') return r.motivoRechazo ? `Rechazada: ${r.motivoRechazo}` : null;
  if (senaPendiente(r)) return `Seña de ${pesos(r.sena!.monto, { redondo: true })} pendiente de pago`;
  if (r.cancelableHasta) {
    const horas = r.amenity.cancelacionMinimaHoras;
    return horas ? `Cancelable hasta ${horas} h antes` : 'Cancelable hasta que empiece';
  }
  return null;
}

interface MisReservasProps {
  proximas: Reserva[] | null;
  anteriores: Reserva[] | null;
  onPagarSena: (r: Reserva) => void;
  onCancelar: (r: Reserva) => void;
  /** Mientras se arma el checkout: el botón no se toca dos veces. */
  pagando: string | null;
}

/** La solapa "Mis reservas" de la pantalla 14: próximas con sus acciones, y las anteriores. */
export function MisReservas({ proximas, anteriores, onPagarSena, onCancelar, pagando }: MisReservasProps) {
  if (!proximas || !anteriores) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
      </div>
    );
  }

  if (proximas.length === 0 && anteriores.length === 0) {
    return (
      <EmptyState
        icono={CalendarX}
        titulo="Todavía no reservaste nada"
        descripcion="Desde Reservar elegís el amenity, el día y el horario."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Próximas</h2>
        {proximas.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tenés reservas por delante.</p>
        ) : (
          proximas.map((r) => {
            const linea = detalle(r);
            const cancelable = r.cancelableHasta !== null && new Date(r.cancelableHasta) > new Date();
            return (
              <Card key={r.id} size="sm">
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex items-center gap-2 font-semibold">
                      <IconoAmenity amenity={r.amenity} className="size-5 text-muted-foreground" />
                      {r.amenity.nombre}
                    </span>
                    <EstadoBadge dominio="reserva" estado={r.estado} />
                  </div>
                  <div>
                    <p className="text-sm">{cuando(r.inicio, r.fin)}</p>
                    {linea && <p className="text-xs text-muted-foreground">{linea}</p>}
                  </div>
                  {senaPendiente(r) ? (
                    <div className="grid grid-cols-2 gap-2">
                      <Button onClick={() => onPagarSena(r)} disabled={pagando === r.id}>
                        {pagando === r.id ? 'Abriendo…' : 'Pagar seña'}
                      </Button>
                      <Button variant="outline" onClick={() => onCancelar(r)} disabled={!cancelable}>
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    cancelable && (
                      <Button variant="outline" className="w-full" onClick={() => onCancelar(r)}>
                        Cancelar reserva
                      </Button>
                    )
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </section>

      {anteriores.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">Anteriores</h2>
          {anteriores.map((r) => (
            <Card key={r.id} size="sm">
              <CardContent className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{r.amenity.nombre}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {fechaCorta(fechaDe(r.inicio))} · {horaDe(r.inicio)} a {horaDe(r.fin)}
                  </p>
                </div>
                <EstadoBadge dominio="reserva" estado={r.estado} />
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
