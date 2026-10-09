'use client';

import { CalendarClock, Check, ChevronDown, Link2, MapPin, X } from 'lucide-react';
import { useState } from 'react';
import { EstadoBadge } from '@/components/estado-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { fechaHora, porcentaje } from '@/lib/formato';
import { cn } from '@/lib/utils';
import type { Asamblea, AsambleaDetalle, EstadoAsistencia } from '@/types/asamblea';
import { MODALIDADES, TIPOS } from './etiquetas';

interface TarjetaAsambleaVecinoProps {
  asamblea: Asamblea;
  /** Se carga aparte: trae el orden del día, el quórum y lo que respondió el vecino. */
  detalle?: AsambleaDetalle;
  /** La unidad activa: la respuesta que se muestra y se manda es la de esa unidad. */
  unidadId: string;
  onResponder: (estado: 'ASISTE' | 'NO_ASISTE') => Promise<void>;
}

/** Una asamblea como la ve el vecino (pantalla 15): cuándo es, el quórum y “Asisto” / “No puedo”. */
export function TarjetaAsambleaVecino({ asamblea, detalle, unidadId, onResponder }: TarjetaAsambleaVecinoProps) {
  const [verPuntos, setVerPuntos] = useState(false);
  const [enviando, setEnviando] = useState<'ASISTE' | 'NO_ASISTE' | null>(null);

  const abierta = asamblea.estado === 'CONVOCADA' || asamblea.estado === 'EN_CURSO';
  const miRespuesta: EstadoAsistencia | undefined = detalle?.miAsistencia?.find((a) => a.unidadId === unidadId)?.estado;
  const quorum = detalle?.quorum;

  async function responder(estado: 'ASISTE' | 'NO_ASISTE') {
    setEnviando(estado);
    try {
      await onResponder(estado);
    } finally {
      setEnviando(null);
    }
  }

  return (
    <Card className={cn(asamblea.estado === 'EN_CURSO' && 'ring-primary')}>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Asamblea {TIPOS[asamblea.tipo].toLowerCase()}
            </p>
            <h2 className="mt-1 leading-snug font-semibold">{asamblea.titulo}</h2>
          </div>
          <EstadoBadge dominio="asamblea" estado={asamblea.estado} />
        </div>

        <ul className="flex flex-col gap-1 text-sm text-secondary-foreground">
          <li className="flex items-center gap-2">
            <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
            <span className="tabular-nums">{fechaHora(asamblea.fechaHora)}</span>
          </li>
          <li className="flex items-center gap-2">
            <MapPin className="size-4 shrink-0 text-muted-foreground" />
            {MODALIDADES[asamblea.modalidad]}
            {asamblea.lugar && ` · ${asamblea.lugar}`}
          </li>
          {asamblea.linkVideollamada && abierta && (
            <li className="flex items-center gap-2">
              <Link2 className="size-4 shrink-0 text-muted-foreground" />
              <a href={asamblea.linkVideollamada} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                Entrar a la videollamada
              </a>
            </li>
          )}
        </ul>

        {abierta && (
          <div className="rounded-lg bg-muted p-3">
            {quorum ? (
              <>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-muted-foreground">Quórum</span>
                  <span className="font-medium tabular-nums">
                    {porcentaje(quorum.porcentaje)} de {porcentaje(quorum.requerido, 2)}
                  </span>
                </div>
                <Progress value={quorum.porcentaje} className="mt-1.5 h-1.5" />
              </>
            ) : detalle ? (
              <p className="text-sm text-muted-foreground">Todavía no hay quórum registrado.</p>
            ) : (
              <Skeleton className="h-8 w-full" />
            )}
          </div>
        )}

        {abierta && detalle && (
          <div className="flex flex-col gap-2">
            {miRespuesta && miRespuesta !== 'SIN_RESPONDER' ? (
              <p className="text-sm">
                {miRespuesta === 'NO_ASISTE' ? 'Avisaste que no podés ir.' : 'Confirmaste tu asistencia.'}
              </p>
            ) : (
              <p className="text-sm font-medium">Confirmá tu asistencia</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={miRespuesta === 'ASISTE' || miRespuesta === 'CON_PODER' ? 'default' : 'outline'}
                disabled={enviando !== null}
                onClick={() => responder('ASISTE')}
              >
                <Check data-icon="inline-start" />
                {enviando === 'ASISTE' ? 'Enviando…' : 'Asisto'}
              </Button>
              <Button
                variant={miRespuesta === 'NO_ASISTE' ? 'default' : 'outline'}
                disabled={enviando !== null}
                onClick={() => responder('NO_ASISTE')}
              >
                <X data-icon="inline-start" />
                {enviando === 'NO_ASISTE' ? 'Enviando…' : 'No puedo'}
              </Button>
            </div>
          </div>
        )}

        {detalle && detalle.puntoOrdenDias.length > 0 && (
          <div className="border-t pt-3">
            <Button
              variant="ghost"
              className="-mx-2 w-[calc(100%+1rem)] justify-between px-2"
              aria-expanded={verPuntos}
              onClick={() => setVerPuntos((v) => !v)}
            >
              Orden del día · {detalle.puntoOrdenDias.length}
              <ChevronDown className={cn('transition-transform', verPuntos && 'rotate-180')} />
            </Button>
            {verPuntos && (
              <ol className="mt-3 flex flex-col gap-3">
                {detalle.puntoOrdenDias.map((p) => (
                  <li key={p.id} className="flex gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground tabular-nums">
                      {p.orden}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{p.titulo}</p>
                      {p.descripcion && <p className="text-sm text-muted-foreground">{p.descripcion}</p>}
                      {p.tipo === 'CON_VOTACION' && (
                        <p className="mt-0.5 text-xs text-muted-foreground">Se vota</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {asamblea.actaUrl && (
          <Button asChild variant="outline" size="sm" className="self-start">
            <a href={asamblea.actaUrl} target="_blank" rel="noreferrer">
              Ver acta
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/** Las asambleas mientras cargan. */
export function TarjetaAsambleaVecinoEsqueleto() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-14 w-full" />
      </CardContent>
    </Card>
  );
}
