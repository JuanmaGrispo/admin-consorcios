'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Fragment } from 'react';
import { EstadoBadge } from '@/components/estado-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { pesos } from '@/lib/formato';
import { cn } from '@/lib/utils';
import type { Amenity, Bloqueo, Reserva } from '@/types/reserva';
import { diaCorto, fechaCorta, fechaDe, horaDe, horasDelDia, instante, sumarDias } from './tiempo';

/** Sin turnos fijos, la grilla igual se dibuja en bloques de 4 horas, como el prototipo. */
const BLOQUE_POR_DEFECTO = 240;

const minutos = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
/** 600 → "10", 630 → "10:30"; pasada la medianoche vuelve a empezar. */
function etiquetaHora(m: number): string {
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  return mm ? `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}` : String(h).padStart(2, '0');
}

/** La ventana de un día en minutos desde sus 00:00; el cierre de madrugada pasa de 1440. */
function enMinutos(horas: { horaApertura: string; horaCierre: string }): { desde: number; hasta: number } {
  const desde = minutos(horas.horaApertura);
  const cierre = minutos(horas.horaCierre);
  return { desde, hasta: cierre > desde ? cierre : cierre + 1440 };
}

/**
 * Las filas de la grilla: las franjas del amenity, de la apertura más
 * temprana al cierre más tarde de la semana (que puede ser de madrugada). Un
 * día que abre menos muestra "Cerrado" en las franjas que no le tocan.
 */
function filas(amenity: Amenity, dias: string[]): { desde: number; hasta: number }[] {
  const ventanas = dias.flatMap((d) => {
    const horas = horasDelDia(amenity, d);
    return horas ? [enMinutos(horas)] : [];
  });
  if (ventanas.length === 0) ventanas.push(enMinutos(amenity));
  const apertura = Math.min(...ventanas.map((v) => v.desde));
  const cierre = Math.max(...ventanas.map((v) => v.hasta));
  const paso = amenity.duracionFranjaMinutos ?? BLOQUE_POR_DEFECTO;
  const resultado = [];
  for (let m = apertura; m < cierre; m += paso) resultado.push({ desde: m, hasta: Math.min(m + paso, cierre) });
  return resultado;
}

type Celda =
  | { tipo: 'libre'; pasada: boolean }
  | { tipo: 'cerrado' }
  | { tipo: 'reserva'; reserva: Reserva; mas: number }
  | { tipo: 'bloqueo'; bloqueo: Bloqueo };

const VIGENTES = ['PENDIENTE', 'APROBADA', 'FINALIZADA'];

function celda(
  desde: Date,
  hasta: Date,
  reservas: Reserva[],
  bloqueos: Bloqueo[],
  ahora: Date,
  abierto: boolean,
): Celda {
  const pisa = (i: string, f: string) => new Date(i) < hasta && new Date(f) > desde;
  const bloqueo = bloqueos.find((b) => pisa(b.desde, b.hasta));
  if (bloqueo) return { tipo: 'bloqueo', bloqueo };
  // Una reserva hecha antes de cambiar el horario se sigue viendo aunque ese rato ya no abra.
  const tomadas = reservas.filter((r) => VIGENTES.includes(r.estado) && pisa(r.inicio, r.fin));
  if (tomadas.length) return { tipo: 'reserva', reserva: tomadas[0], mas: tomadas.length - 1 };
  if (!abierto) return { tipo: 'cerrado' };
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
  /** Tocar una reserva pendiente deja aprobarla o rechazarla ahí mismo. */
  onAprobar: (reserva: Reserva) => void;
  onRechazar: (reserva: Reserva) => void;
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
  onAprobar,
  onRechazar,
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

          {filas(amenity, dias).map((f) => (
            <Fragment key={f.desde}>
              <div className="flex items-center font-mono text-xs text-muted-foreground">
                {etiquetaHora(f.desde)} a {etiquetaHora(f.hasta)}
              </div>
              {dias.map((d) => {
                const desde = new Date(instante(d, '00:00').getTime() + f.desde * 60_000);
                const hasta = new Date(instante(d, '00:00').getTime() + f.hasta * 60_000);
                if (!reservas || !bloqueos) return <Skeleton key={d} className="h-11 rounded-lg" />;
                const horas = horasDelDia(amenity, d);
                const ventana = horas && enMinutos(horas);
                const abierto = !!ventana && f.desde >= ventana.desde && f.hasta <= ventana.hasta;
                return (
                  <CeldaSemana
                    key={d}
                    celda={celda(desde, hasta, reservas, bloqueos, ahora, abierto)}
                    onBloqueo={onBloqueo}
                    onAprobar={onAprobar}
                    onRechazar={onRechazar}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const BASE = 'flex h-11 items-center justify-center rounded-lg border px-1.5 text-center text-xs leading-tight';

interface CeldaSemanaProps {
  celda: Celda;
  onBloqueo: (b: Bloqueo) => void;
  onAprobar: (r: Reserva) => void;
  onRechazar: (r: Reserva) => void;
}

function CeldaSemana({ celda: c, onBloqueo, onAprobar, onRechazar }: CeldaSemanaProps) {
  if (c.tipo === 'cerrado') {
    return <div className={cn(BASE, 'border-transparent bg-muted text-muted-foreground')}>Cerrado</div>;
  }

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
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            BASE,
            'font-medium hover:border-foreground/30',
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
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <PopoverHeader>
          <PopoverTitle className="flex items-center justify-between gap-2">
            {r.unidad.etiqueta}
            <EstadoBadge dominio="reserva" estado={r.estado} />
          </PopoverTitle>
          <PopoverDescription>
            {r.solicitadaPor.nombre} {r.solicitadaPor.apellido} · {fechaCorta(fechaDe(r.inicio))}, {horaDe(r.inicio)}{' '}
            a {horaDe(r.fin)}
            {r.motivo ? ` · ${r.motivo}` : ''}
          </PopoverDescription>
        </PopoverHeader>
        {r.sena && (
          <p className="text-xs text-muted-foreground">
            Seña de {pesos(r.sena.monto)} {r.sena.pagada ? 'pagada' : 'pendiente de pago'}
          </p>
        )}
        {c.mas > 0 && (
          <p className="text-xs text-muted-foreground">
            Y {c.mas} {c.mas === 1 ? 'reserva más' : 'reservas más'} en esta franja.
          </p>
        )}
        {pendiente && (
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" onClick={() => onAprobar(r)}>
              Aprobar
            </Button>
            <Button size="sm" variant="outline" onClick={() => onRechazar(r)}>
              Rechazar
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
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

