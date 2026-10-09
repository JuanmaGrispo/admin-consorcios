'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { EstadoDelDia } from '@/types/reserva';
import { diaDeLaSemana, fechaLarga, lunesDe, nombreDelMes, sumarDias } from './tiempo';

const LETRAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Las celdas de un mes: de su primer lunes a completar la última semana. */
export function celdasDelMes(mes: string): string[] {
  const primero = `${mes}-01`;
  const inicio = lunesDe(primero);
  const ultimo = sumarDias(`${sumarDias(`${mes}-28`, 4).slice(0, 7)}-01`, -1);
  const fin = sumarDias(ultimo, (7 - diaDeLaSemana(ultimo)) % 7);
  const celdas: string[] = [];
  for (let d = inicio; d <= fin; d = sumarDias(d, 1)) celdas.push(d);
  return celdas;
}

interface CalendarioMensualProps {
  /** "2026-09". */
  mes: string;
  onCambiarMes: (mes: string) => void;
  /** El estado de cada día que devolvió el backend; null mientras carga. */
  dias: Map<string, EstadoDelDia> | null;
  elegido: string | null;
  onElegir: (fecha: string) => void;
}

/**
 * El mes del amenity (pantalla 14): los días con lugar se eligen, los llenos y
 * los pasados se ven en gris. El elegido, en azul.
 */
export function CalendarioMensual({ mes, onCambiarMes, dias, elegido, onElegir }: CalendarioMensualProps) {
  const anterior = sumarDias(`${mes}-01`, -1).slice(0, 7);
  const siguiente = sumarDias(`${mes}-28`, 4).slice(0, 7);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="font-semibold">{nombreDelMes(mes)}</p>
        <div className="flex">
          <Button variant="ghost" size="icon-sm" aria-label="Mes anterior" onClick={() => onCambiarMes(anterior)}>
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Mes siguiente" onClick={() => onCambiarMes(siguiente)}>
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-center">
        {LETRAS.map((l, i) => (
          <span key={i} className="text-xs text-muted-foreground">
            {l}
          </span>
        ))}
        {celdasDelMes(mes).map((fecha) => {
          const delMes = fecha.startsWith(mes);
          if (!dias) return <Skeleton key={fecha} className="aspect-square rounded-lg" />;
          const estado = dias.get(fecha);
          const elegible = delMes && (estado === 'DISPONIBLE' || estado === 'PARCIAL');
          const esElegido = fecha === elegido;
          return (
            <button
              key={fecha}
              type="button"
              disabled={!elegible}
              onClick={() => onElegir(fecha)}
              aria-pressed={esElegido}
              aria-label={`${fechaLarga(fecha)}${elegible ? '' : ', sin lugar'}`}
              className={cn(
                'flex aspect-square items-center justify-center rounded-lg border text-sm tabular-nums transition-colors',
                !delMes && 'border-transparent text-muted-foreground/50',
                delMes && !elegible && 'border-transparent bg-muted text-muted-foreground',
                elegible && 'hover:border-primary',
                esElegido && 'border-primary bg-primary font-semibold text-primary-foreground hover:border-primary',
              )}
            >
              {Number(fecha.slice(8, 10))}
            </button>
          );
        })}
      </div>

      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-primary" />
          Elegido
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-muted ring-1 ring-border" />
          Sin lugar
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm ring-1 ring-border" />
          Disponible
        </span>
      </div>
    </div>
  );
}
