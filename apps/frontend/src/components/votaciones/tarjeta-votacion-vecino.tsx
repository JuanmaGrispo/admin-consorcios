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
  /** El título de la asamblea de la que cuelga, si cuelga de una. */
  tituloAsamblea?: string;
  /** Se carga aparte: trae mis unidades habilitadas, mi voto y el conteo si ya lo puedo ver. */
  detalle?: VotacionDetalle;
  onVotar: (detalle: VotacionDetalle) => void;
}

/**
 * Las mismas reglas que aplica el backend antes de aceptar un voto desde la
 * app. Devuelve null si se puede votar ahora, o por qué no.
 */
function motivoParaNoVotar(detalle: VotacionDetalle): string | null {
  if (detalle.asamblea) {
    if (detalle.asamblea.estado === 'EN_CURSO') return null;
    if (detalle.asamblea.estado === 'CONVOCADA' && detalle.permiteVotoAnticipado) return null;
    return 'Se vota durante la asamblea.';
  }
  if (Date.now() < new Date(detalle.apertura).getTime()) {
    return `Se puede votar desde el ${fechaHora(detalle.apertura)}.`;
  }
  return null;
}

/** "Cierra en 8 días", "Cierra en 5 horas": lo que le queda a una votación abierta. */
function cierraEn(cierre: string, ahora = Date.now()): string {
  const minutos = Math.floor((new Date(cierre).getTime() - ahora) / 60_000);
  if (minutos < 60) return 'Cierra en menos de una hora';
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Cierra en ${horas} ${horas === 1 ? 'hora' : 'horas'}`;
  const dias = Math.floor(horas / 24);
  return `Cierra en ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

/** Una votación como la ve el vecino (pantalla 15): qué se vota, hasta cuándo, si ya votó y el resultado. */
export function TarjetaVotacionVecino({ votacion, tituloAsamblea, detalle, onVotar }: TarjetaVotacionVecinoProps) {
  const abierta = votacion.estado === 'ABIERTA';
  const unidades = detalle?.misUnidades ?? [];
  const pendientes = unidades.filter((u) => !u.voto);
  const opciones = new Map(votacion.opcionVotos.map((o) => [o.id, o.etiqueta]));
  const motivo = detalle ? motivoParaNoVotar(detalle) : null;

  return (
    <Card id={`votacion-${votacion.id}`} className="scroll-mt-20">
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              {votacion.asambleaId ? `En asamblea${tituloAsamblea ? ` · ${tituloAsamblea}` : ''}` : 'Votación digital'}
            </p>
            <h2 className="mt-1 leading-snug font-semibold">{votacion.titulo}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
              {abierta ? (
                <>
                  <span className="font-medium text-foreground">{cierraEn(votacion.cierre)}</span> · el{' '}
                  {fechaHora(votacion.cierre)}
                </>
              ) : (
                `Cerró el ${fechaHora(votacion.cierre)}`
              )}
            </p>
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

            {abierta &&
              pendientes.length > 0 &&
              (motivo ? (
                <p className="rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">{motivo}</p>
              ) : (
                <Button onClick={() => onVotar(detalle)}>
                  <Vote data-icon="inline-start" />
                  Votar
                </Button>
              ))}

            {detalle.escrutinio && (
              <div className="border-t pt-3">
                <EscrutinioBarras
                  escrutinio={detalle.escrutinio}
                  cerrada={votacion.estado === 'CERRADA'}
                  reglas={votacion}
                />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
