'use client';

import { Check, FileText, Vote } from 'lucide-react';
import { EstadoBadge } from '@/components/estado-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fechaHora } from '@/lib/formato';
import type { Votacion, VotacionDetalle } from '@/types/votacion';
import { EscrutinioBarras } from './escrutinio-barras';

interface TarjetaVotacionVecinoProps {
  votacion: Votacion;
  /** Se carga aparte: trae mis unidades habilitadas, mi voto y el conteo si ya lo puedo ver. */
  detalle?: VotacionDetalle;
  onVotar: (detalle: VotacionDetalle) => void;
}

/** Una votación como la ve el vecino (pantalla 15): qué se vota, hasta cuándo, si ya votó y el resultado. */
export function TarjetaVotacionVecino({ votacion, detalle, onVotar }: TarjetaVotacionVecinoProps) {
  const abierta = votacion.estado === 'ABIERTA';
  const unidades = detalle?.misUnidades ?? [];
  const pendientes = unidades.filter((u) => !u.voto);
  const opciones = new Map(votacion.opcionVotos.map((o) => [o.id, o.etiqueta]));

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground tabular-nums">
              {abierta ? `Cierra el ${fechaHora(votacion.cierre)}` : `Cerró el ${fechaHora(votacion.cierre)}`}
            </p>
            <h2 className="mt-1 leading-snug font-semibold">{votacion.titulo}</h2>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <EstadoBadge dominio="votacion" estado={votacion.estado} />
            {votacion.resultado && <EstadoBadge dominio="resultado" estado={votacion.resultado} />}
          </div>
        </div>

        {votacion.descripcion && (
          <p className="text-sm/relaxed whitespace-pre-line text-secondary-foreground">{votacion.descripcion}</p>
        )}
        {votacion.adjuntoUrl && (
          <a
            href={votacion.adjuntoUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2.5 text-sm text-secondary-foreground hover:text-primary"
          >
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            Ver documento adjunto
          </a>
        )}

        {!detalle ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <>
            {unidades.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {unidades.map((u) => (
                  <li key={u.unidadId} className="flex items-center gap-2 text-sm">
                    <Check
                      className={u.voto ? 'size-4 shrink-0 text-success' : 'size-4 shrink-0 text-muted-foreground/40'}
                    />
                    <span className="min-w-0 flex-1">
                      {u.etiqueta}
                      <span className="text-muted-foreground"> · vale {u.pesoPorcentaje.toLocaleString('es-AR')}%</span>
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {u.voto ? `Votaste: ${opciones.get(u.voto.opcionId) ?? '—'}` : abierta ? 'Sin votar' : 'No votó'}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {abierta && pendientes.length > 0 && (
              <Button onClick={() => onVotar(detalle)}>
                <Vote data-icon="inline-start" />
                Votar
              </Button>
            )}

            {detalle.escrutinio && (
              <div className="border-t pt-3">
                <EscrutinioBarras escrutinio={detalle.escrutinio} cerrada={votacion.estado === 'CERRADA'} />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
