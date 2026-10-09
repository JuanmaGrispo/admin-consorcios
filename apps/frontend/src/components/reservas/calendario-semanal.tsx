'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Fragment } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Amenity, Bloqueo, Reserva } from '@/types/reserva';
import { diaCorto, fechaCorta, instante, sumarDias } from './tiempo';

/** Sin turnos fijos, la grilla igual se dibuja en bloques de 4 horas, como el prototipo. */
const BLOQUE_POR_DEFECTO = 240;

const minutos = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
/** 600 → "10", 630 → "10:30"; pasada la medianoche vuelve a empezar. */
function etiquetaHora(m: number): string {
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  return mm ? `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}` : String(h).padStart(2, '0');
}

/** Las filas de la grilla: las franjas del amenity, de la apertura al cierre (que puede ser de madrugada). */
function filas(amenity: Amenity): { desde: number; hasta: number }[] {
  const apertura = minutos(amenity.horaApertura);
  let cierre = minutos(amenity.horaCierre);
  if (cierre <= apertura) cierre += 1440;
  const paso = amenity.duracionFranjaMinutos ?? BLOQUE_POR_DEFECTO;
  const resultado = [];
  for (let m = apertura; m < cierre; m += paso) resultado.push({ desde: m, hasta: Math.min(m + paso, cierre) });
  return resultado;
}

type Celda =
  | { tipo: 'libre'; pasada: boolean }
  | { tipo: 'reserva'; reserva: Reserva; mas: number }
  | { tipo: 'bloqueo'; bloqueo: Bloqueo };

const VIGENTES = ['PENDIENTE', 'APROBADA', 'FINALIZADA'];

function celda(desde: Date, hasta: Date, reservas: Reserva[], bloqueos: Bloqueo[], ahora: Date): Celda {
  const pisa = (i: string, f: string) => new Date(i) < hasta && new Date(f) > desde;
  const bloqueo = bloqueos.find((b) => pisa(b.desde, b.hasta));
  if (bloqueo) return { tipo: 'bloqueo', bloqueo };
  const tomadas = reservas.filter((r) => VIGENTES.includes(r.estado) && pisa(r.inicio, r.fin));
  if (tomadas.length) return { tipo: 'reserva', reserva: tomadas[0], mas: tomadas.length - 1 };
  return { tipo: 'libre', pasada: hasta <= ahora };
}

interface CalendarioSemanalProps {
  amenity: Amenity;
  /** El lunes de la semana que se muestra. */
  lunes: string;
  /** Las reservas y bloqueos de esa semana; null mientras cargan. */
  reservas: Reserva[] | null;
  bloqueos: Bloqueo[] | null;
  onCambiarSemana: (lunes: string) => void;
  /** Tocar un bloqueo ofrece quitarlo. */
  onBloqueo: (bloqueo: Bloqueo) => void;
}

/**
 * La semana del amenity (pantalla 05): una fila por franja, una columna por
 * día. Aprobadas en azul, pendientes en ámbar y los bloqueos en gris.
 */
export function CalendarioSemanal({
  amenity,
  lunes,
  reservas,
  bloqueos,
  onCambiarSemana,
  onBloqueo,
}: CalendarioSemanalProps) {
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
  const domingo = dias[6];
  const ahora = new Date();
  const descripcion = amenity.duracionFranjaMinutos
    ? `franjas de ${amenity.duracionFranjaMinutos % 60 ? `${amenity.duracionFranjaMinutos} minutos` : `${amenity.duracionFranjaMinutos / 60} horas`}`
    : 'horario libre, en bloques de 4 horas';

  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>
            Semana del {lunes.slice(8, 10)} al {fechaCorta(domingo)}
          </CardTitle>
          <CardDescription>
            {amenity.nombre} · {descripcion}
          </CardDescription>
        </div>
        <div className="flex items-center gap-3">
          <Leyenda />
          <div className="flex">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Semana anterior"
              onClick={() => onCambiarSemana(sumarDias(lunes, -7))}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Semana siguiente"
              onClick={() => onCambiarSemana(sumarDias(lunes, 7))}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="grid min-w-[42rem] grid-cols-[4.5rem_repeat(7,minmax(0,1fr))] gap-1.5">
          <div />
          {dias.map((d) => (
            <div key={d} className="pb-1 text-center">
              <p className="text-xs text-muted-foreground">{diaCorto(d)}</p>
              <p className="font-semibold tabular-nums">{d.slice(8, 10)}</p>
            </div>
          ))}

          {filas(amenity).map((f) => (
            <Fragment key={f.desde}>
              <div className="flex items-center font-mono text-xs text-muted-foreground">
                {etiquetaHora(f.desde)} a {etiquetaHora(f.hasta)}
              </div>
              {dias.map((d) => {
                const desde = new Date(instante(d, '00:00').getTime() + f.desde * 60_000);
                const hasta = new Date(instante(d, '00:00').getTime() + f.hasta * 60_000);
                if (!reservas || !bloqueos) return <Skeleton key={d} className="h-11 rounded-lg" />;
                return <CeldaSemana key={d} celda={celda(desde, hasta, reservas, bloqueos, ahora)} onBloqueo={onBloqueo} />;
              })}
            </Fragment>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const BASE = 'flex h-11 items-center justify-center rounded-lg border px-1.5 text-center text-xs leading-tight';

function CeldaSemana({ celda: c, onBloqueo }: { celda: Celda; onBloqueo: (b: Bloqueo) => void }) {
  if (c.tipo === 'libre') {
    return <div className={cn(BASE, 'text-muted-foreground', c.pasada && 'opacity-50')}>Libre</div>;
  }

  if (c.tipo === 'bloqueo') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onBloqueo(c.bloqueo)}
            className={cn(BASE, 'border-transparent bg-muted font-medium text-secondary-foreground hover:border-border')}
          >
            <span className="line-clamp-2">{c.bloqueo.motivo || 'Bloqueado'}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>Bloqueo de la administración · tocá para quitarlo</TooltipContent>
      </Tooltip>
    );
  }

  const r = c.reserva;
  const pendiente = r.estado === 'PENDIENTE';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          tabIndex={0}
          className={cn(
            BASE,
            'font-medium',
            pendiente
              ? 'border-warning/50 bg-warning/10 text-warning'
              : 'border-primary/50 bg-accent text-accent-foreground',
          )}
        >
          <span className="line-clamp-2">
            {r.unidad.etiqueta}
            {r.motivo ? ` · ${r.motivo}` : ''}
            {c.mas > 0 ? ` +${c.mas}` : ''}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        {r.unidad.etiqueta} · {r.solicitadaPor.nombre} {r.solicitadaPor.apellido} ·{' '}
        {pendiente ? 'esperando aprobación' : r.estado === 'FINALIZADA' ? 'finalizada' : 'aprobada'}
      </TooltipContent>
    </Tooltip>
  );
}

function Leyenda() {
  const item = (color: string, texto: string) => (
    <span className="flex items-center gap-1.5">
      <span className={cn('size-2 rounded-full', color)} />
      {texto}
    </span>
  );
  return (
    <div className="hidden items-center gap-3 text-xs text-muted-foreground sm:flex">
      {item('bg-primary', 'Aprobada')}
      {item('bg-warning', 'Pendiente')}
      {item('bg-border', 'Bloqueada')}
    </div>
  );
}

