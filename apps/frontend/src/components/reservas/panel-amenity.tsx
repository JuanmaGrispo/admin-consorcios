'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { pesos } from '@/lib/formato';
import { cn } from '@/lib/utils';
import type { Amenity, Reserva } from '@/types/reserva';
import { horario, horas, resumenAmenity } from './amenity';
import { IconoAmenity } from './icono-amenity';
import { fechaDe, horaDe, diaMes, nombreDelDia } from './tiempo';

/** La lista para elegir el amenity que se mira (pantalla 05, arriba a la izquierda). */
export function ListaAmenities({
  amenities,
  elegido,
  onElegir,
  onNuevo,
}: {
  amenities: Amenity[];
  elegido: string | null;
  onElegir: (id: string) => void;
  onNuevo: () => void;
}) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-3">
        <CardTitle className="text-sm">Amenities</CardTitle>
      </CardHeader>
      <ul>
        {amenities.map((a) => (
          <li key={a.id} className="border-b last:border-b-0">
            <button
              type="button"
              onClick={() => onElegir(a.id)}
              aria-current={a.id === elegido}
              className={cn(
                'flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted',
                a.id === elegido && 'bg-accent text-accent-foreground hover:bg-accent',
              )}
            >
              <IconoAmenity amenity={a} className="size-5" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{a.nombre}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {a.activo ? resumenAmenity(a, 'admin') : 'Dado de baja'}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="border-t p-2">
        <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={onNuevo}>
          <Plus data-icon="inline-start" />
          Agregar amenity
        </Button>
      </div>
    </Card>
  );
}

/** "Reglas del SUM": lo que el vecino tiene que cumplir para reservar. */
export function ReglasAmenity({ amenity: a }: { amenity: Amenity }) {
  const filas: [string, React.ReactNode][] = [
    ['Horario', horario(a)],
    ['Anticipación mínima', a.anticipacionMinimaHoras ? horas(a.anticipacionMinimaHoras) : 'Sin mínimo'],
    ['Duración máxima', a.duracionMaximaHoras ? horas(a.duracionMaximaHoras) : 'Sin límite'],
    ['Seña', a.montoSena > 0 ? <span className="font-mono tabular-nums">{pesos(a.montoSena)}</span> : 'Sin seña'],
    [
      'Deuda de expensas',
      a.bloqueaConDeuda ? <span className="text-destructive">Bloquea la reserva</span> : 'No bloquea',
    ],
  ];
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm">Reglas del {a.nombre}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="flex flex-col gap-2 text-sm">
          {filas.map(([etiqueta, valor]) => (
            <div key={etiqueta} className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{etiqueta}</dt>
              <dd className="text-right font-medium">{valor}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

/** "Esperando aprobación": las pendientes del consorcio, con su acción a mano. */
export function PendientesAprobacion({
  reservas,
  onAprobar,
  onRechazar,
}: {
  /** Null mientras cargan. */
  reservas: Reserva[] | null;
  onAprobar: (r: Reserva) => void;
  onRechazar: (r: Reserva) => void;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm">Esperando aprobación</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {!reservas ? (
          <Skeleton className="h-24 rounded-lg" />
        ) : reservas.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay reservas esperando aprobación.</p>
        ) : (
          reservas.map((r) => (
            <div key={r.id} className="flex flex-col gap-2 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">
                  {r.amenity.nombre} · {nombreDelDia(fechaDe(r.inicio))} {diaMes(fechaDe(r.inicio))},{' '}
                  {horaDe(r.inicio)} a {horaDe(r.fin)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.unidad.etiqueta} · {r.solicitadaPor.nombre} {r.solicitadaPor.apellido}
                  {r.motivo ? ` · ${r.motivo}` : ''}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" onClick={() => onAprobar(r)}>
                  Aprobar
                </Button>
                <Button size="sm" variant="outline" onClick={() => onRechazar(r)}>
                  Rechazar
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
