'use client';

import { CalendarCheck, CheckCircle2, ListChecks } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api';
import { pesos } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { reservasService } from '@/services/reservas';
import type { Amenity, Disponibilidad, EstadoDeFranja, EstadoDelDia } from '@/types/reserva';
import { resumenAmenity } from './amenity';
import { celdasDelMes, CalendarioMensual } from './calendario-mensual';
import { IconoAmenity } from './icono-amenity';
import { diaMes, hhmm, horaDe, hoy, nombreDelDia } from './tiempo';

const ROTULO: Record<EstadoDeFranja, string> = {
  LIBRE: 'Disponible',
  OCUPADA: 'Ocupada',
  BLOQUEADA: 'Bloqueada',
  PASADA: 'Ya pasó',
};

/** Lo que el vecino tiene que saber antes de confirmar (pantalla 14). */
function reglas(a: Amenity): string[] {
  const lista: string[] = [];
  if (a.montoSena > 0) {
    lista.push(
      `Seña de ${pesos(a.montoSena, { redondo: true })}, se devuelve a ${a.diasDevolucionSena === 2 ? 'las 48 h' : `los ${a.diasDevolucionSena} días`} si no hay daños.`,
    );
  }
  for (const linea of (a.reglamento ?? '').split('\n')) if (linea.trim()) lista.push(linea.trim());
  if (a.anticipacionMinimaHoras > 0) lista.push(`Se reserva con ${a.anticipacionMinimaHoras} horas de anticipación.`);
  if (a.requiereAprobacion) lista.push('La administración la tiene que aprobar.');
  if (a.bloqueaConDeuda) lista.push('No se puede reservar con expensas vencidas.');
  return lista;
}

/** Cada media hora de la ventana del amenity, para elegir a mano cuando no hay turnos fijos. */
function horasDeLaVentana(d: Disponibilidad): string[] {
  const aMin = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
  const inicio = aMin(d.horaApertura);
  let fin = aMin(d.horaCierre);
  if (fin <= inicio) fin += 1440;
  const horas: string[] = [];
  for (let m = inicio; m <= fin; m += 30) {
    const mm = m % 1440;
    horas.push(`${String(Math.floor(mm / 60)).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`);
  }
  return horas;
}

interface ReservarProps {
  amenities: Amenity[];
  unidadId: string;
  /** Después de confirmar: la pantalla pasa a "Mis reservas". */
  onReservada: (mensaje: string) => void;
}

/** La solapa "Reservar" de la pantalla 14. */
export function Reservar({ amenities, unidadId, onReservada }: ReservarProps) {
  const [amenityId, setAmenityId] = useState(amenities[0]?.id ?? '');
  const [mes, setMes] = useState(() => hoy().slice(0, 7));
  const [fecha, setFecha] = useState<string | null>(null);
  const [franja, setFranja] = useState<{ desde: string; hasta: string } | null>(null);
  const [motivo, setMotivo] = useState('');
  // Lo que llega del backend se guarda con la clave que lo pidió: si el vecino
  // cambió de mes o de día antes de que llegue, no se muestra lo de otro.
  const [calendario, setCalendario] = useState<{ clave: string; dias: Map<string, EstadoDelDia> } | null>(null);
  const [disponibilidad, setDisponibilidad] = useState<{ clave: string; d: Disponibilidad } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amenity = amenities.find((a) => a.id === amenityId);

  useEffect(() => {
    if (!amenityId) return;
    let vigente = true;
    const celdas = celdasDelMes(mes);
    reservasService
      .calendario(amenityId, celdas[0], celdas[celdas.length - 1])
      .then((c) => {
        if (vigente) setCalendario({ clave: `${amenityId}:${mes}`, dias: new Map(c.dias.map((d) => [d.fecha, d.estado])) });
      })
      .catch((err) => vigente && setError(err instanceof ApiError ? err.message : 'No se pudo cargar el calendario.'));
    return () => {
      vigente = false;
    };
  }, [amenityId, mes]);

  useEffect(() => {
    if (!amenityId || !fecha) return;
    let vigente = true;
    reservasService
      .disponibilidad(amenityId, fecha)
      .then((d) => vigente && setDisponibilidad({ clave: `${amenityId}:${fecha}`, d }))
      .catch((err) => vigente && setError(err instanceof ApiError ? err.message : 'No se pudo cargar el día.'));
    return () => {
      vigente = false;
    };
  }, [amenityId, fecha]);

  const dias = calendario?.clave === `${amenityId}:${mes}` ? calendario.dias : null;
  const dia = disponibilidad?.clave === `${amenityId}:${fecha}` ? disponibilidad.d : null;

  function elegirAmenity(id: string) {
    setAmenityId(id);
    setFecha(null);
    setFranja(null);
    setError(null);
  }

  function elegirFecha(f: string) {
    setFecha(f);
    setFranja(null);
    setError(null);
  }

  async function confirmar() {
    if (!amenity || !fecha || !franja) return;
    setEnviando(true);
    setError(null);
    try {
      const r = await reservasService.crear({
        amenityId: amenity.id,
        unidadId,
        fecha,
        horaInicio: franja.desde,
        horaFin: franja.hasta,
        motivo: motivo.trim() || undefined,
      });
      onReservada(
        r.estado === 'PENDIENTE'
          ? `Pediste el ${amenity.nombre}: queda esperando aprobación`
          : `Reservaste el ${amenity.nombre}`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo reservar.');
      setEnviando(false);
    }
  }

  if (!amenity) return null;

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Amenity</h2>
        {amenities.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => elegirAmenity(a.id)}
            aria-pressed={a.id === amenityId}
            className={cn(
              'flex items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary/50',
              a.id === amenityId && 'border-primary bg-accent',
            )}
          >
            <IconoAmenity amenity={a} className={cn('size-5', a.id === amenityId && 'text-primary')} />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{a.nombre}</span>
              <span className="block text-xs text-muted-foreground">{resumenAmenity(a, 'vecino')}</span>
            </span>
            {a.id === amenityId && <CheckCircle2 className="size-5 text-primary" />}
          </button>
        ))}
      </section>

      <CalendarioMensual mes={mes} onCambiarMes={setMes} dias={dias} elegido={fecha} onElegir={elegirFecha} />

      {fecha && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            {nombreDelDia(fecha)} {diaMes(fecha)} · {dia?.franjas ? 'Franjas' : 'Horario'}
          </h2>
          {!dia ? (
            <Skeleton className="h-24 rounded-lg" />
          ) : dia.franjas ? (
            dia.franjas.map((f) => {
              const elegida = franja?.desde === hhmm(f.horaInicio);
              const libre = f.estado === 'LIBRE';
              return (
                <button
                  key={f.horaInicio}
                  type="button"
                  disabled={!libre}
                  onClick={() => setFranja({ desde: hhmm(f.horaInicio), hasta: hhmm(f.horaFin) })}
                  aria-pressed={elegida}
                  className={cn(
                    'flex items-center justify-between rounded-lg border px-4 py-3 text-left',
                    !libre && 'border-transparent bg-muted text-muted-foreground',
                    libre && 'bg-card hover:border-primary/50',
                    elegida && 'border-primary bg-accent text-accent-foreground',
                  )}
                >
                  <span className="font-mono text-sm font-semibold">
                    {hhmm(f.horaInicio)} a {hhmm(f.horaFin)}
                  </span>
                  <span className="text-xs">
                    {elegida
                      ? 'Seleccionada'
                      : libre && dia.lugares > 1
                        ? `Disponible · ${f.lugaresLibres} ${f.lugaresLibres === 1 ? 'lugar' : 'lugares'}`
                        : ROTULO[f.estado]}
                  </span>
                </button>
              );
            })
          ) : (
            <HorarioLibre dia={dia} franja={franja} onCambiar={setFranja} />
          )}
        </section>
      )}

      {fecha && franja?.hasta && (
        <Field>
          <FieldLabel htmlFor="motivo">¿Para qué es? (opcional)</FieldLabel>
          <Input
            id="motivo"
            maxLength={120}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Cumpleaños, reunión, almuerzo…"
          />
        </Field>
      )}

      {reglas(amenity).length > 0 && (
        <section className="rounded-xl border bg-muted p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <ListChecks className="size-4 text-muted-foreground" />
            Antes de confirmar
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-secondary-foreground">
            {reglas(amenity).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button
        size="lg"
        className="w-full"
        disabled={!fecha || !franja?.desde || !franja.hasta || enviando}
        onClick={confirmar}
      >
        <CalendarCheck data-icon="inline-start" />
        {enviando ? 'Reservando…' : 'Confirmar reserva'}
      </Button>
    </div>
  );
}

/** Sin turnos fijos: desde y hasta a elección, mostrando lo que ya está tomado. */
function HorarioLibre({
  dia,
  franja,
  onCambiar,
}: {
  dia: Disponibilidad;
  franja: { desde: string; hasta: string } | null;
  onCambiar: (f: { desde: string; hasta: string } | null) => void;
}) {
  const horas = horasDeLaVentana(dia);
  const desde = franja?.desde ?? '';
  const hasta = franja?.hasta ?? '';
  const ocupado = [
    ...dia.ocupado.filter((o) => o.estado === 'PENDIENTE' || o.estado === 'APROBADA').map((o) => [o.inicio, o.fin]),
    ...dia.bloqueos.map((b) => [b.desde, b.hasta]),
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor="desde">Desde</FieldLabel>
          <Select
            value={desde}
            // Por posición y no como texto: la ventana puede cruzar la medianoche (22:00 a 02:00).
            onValueChange={(v) => onCambiar({ desde: v, hasta: horas.indexOf(hasta) > horas.indexOf(v) ? hasta : '' })}
          >
            <SelectTrigger id="desde" className="w-full">
              <SelectValue placeholder="Elegí" />
            </SelectTrigger>
            <SelectContent>
              {horas.slice(0, -1).map((h) => (
                <SelectItem key={h} value={h}>
                  {h}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="hasta">Hasta</FieldLabel>
          <Select
            value={hasta}
            disabled={!desde}
            onValueChange={(v) => onCambiar({ desde, hasta: v })}
          >
            <SelectTrigger id="hasta" className="w-full">
              <SelectValue placeholder="Elegí" />
            </SelectTrigger>
            <SelectContent>
              {horas.slice(horas.indexOf(desde) + 1).map((h) => (
                <SelectItem key={h} value={h}>
                  {h}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">
        {ocupado.length
          ? `Ya tomado: ${ocupado.map(([i, f]) => `${horaDe(i)} a ${horaDe(f)}`).join(', ')}.`
          : 'El día está libre.'}
        {dia.duracionMaximaHoras ? ` Hasta ${dia.duracionMaximaHoras} horas por reserva.` : ''}
      </p>
    </div>
  );
}

/** "Reservar" mientras cargan los amenities. */
export function ReservarEsqueleto() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-16 rounded-xl" />
      <Skeleton className="h-16 rounded-xl" />
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}
