'use client';

import { Landmark, Vote } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  TarjetaAsambleaVecino,
  TarjetaAsambleaVecinoEsqueleto,
} from '@/components/asambleas/tarjeta-asamblea-vecino';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUnidadActiva } from '@/components/vecino/unidad-activa';
import { DialogoVotar } from '@/components/votaciones/dialogo-votar';
import { TarjetaVotacionVecino } from '@/components/votaciones/tarjeta-votacion-vecino';
import { usePedido } from '@/hooks/use-pedido';
import { ApiError } from '@/lib/api';
import { asambleasService } from '@/services/asambleas';
import { votacionesService } from '@/services/votaciones';
import type { Asamblea } from '@/types/asamblea';
import type { VotacionDetalle } from '@/types/votacion';

const CERRADAS = ['CERRADA', 'CERRADA_SIN_QUORUM'];

/** Los detalles que llegaron, por id; los que fallaron quedan afuera. */
function porId<T extends { id: string }>(resultados: PromiseSettledResult<T>[]): Record<string, T> {
  return Object.fromEntries(
    resultados.flatMap((r) => (r.status === 'fulfilled' ? [[r.value.id, r.value] as const] : [])),
  );
}

export default function VecinoAsambleasPage() {
  const { unidad } = useUnidadActiva();
  // Otra unidad es otra respuesta y otros votos: arranca de cero.
  return <AsambleasYVotaciones key={unidad.id} />;
}

/** Asambleas y votaciones del edificio de la unidad activa (pantalla 15). */
function AsambleasYVotaciones() {
  const { unidad, consorcio } = useUnidadActiva();
  const [votando, setVotando] = useState<VotacionDetalle | null>(null);

  const listas = usePedido(
    `asambleas-vecino:${consorcio.id}`,
    () =>
      Promise.all([
        asambleasService.listar({ consorcioId: consorcio.id }),
        votacionesService.listar({ consorcioId: consorcio.id }),
      ]),
    'No se pudieron cargar las asambleas.',
  );
  const [asambleas, votaciones] = listas.datos ?? [null, null];
  const error = listas.error ?? null;

  // El detalle trae lo personal (mi respuesta, mi voto): se pide aparte, una
  // vez que están las listas. Si uno falla, esa tarjeta se ve sin los botones.
  const ids = asambleas && votaciones ? [...asambleas, ...votaciones].map((x) => x.id).join(',') : null;
  const detalles = usePedido(ids === null ? null : `detalles:${ids}`, async () => {
    const [deAsambleas, deVotaciones] = await Promise.all([
      Promise.allSettled((asambleas ?? []).map((a) => asambleasService.obtener(a.id))),
      Promise.allSettled((votaciones ?? []).map((v) => votacionesService.obtener(v.id))),
    ]);
    return {
      asambleas: porId(deAsambleas),
      votaciones: porId(deVotaciones),
    };
  });
  const deDetalles = detalles.datos ?? detalles.ultimo;
  const detallesAsamblea = deDetalles?.asambleas ?? {};
  const detallesVotacion = deDetalles?.votaciones ?? {};

  /** Después de responder o votar: lo personal cambió, las listas no. */
  const recargar = detalles.recargar;

  async function responder(asamblea: Asamblea, estado: 'ASISTE' | 'NO_ASISTE') {
    try {
      await asambleasService.confirmarAsistencia(asamblea.id, { estado, unidadId: unidad.id });
      toast.success(estado === 'ASISTE' ? 'Asistencia confirmada' : 'Avisaste que no podés ir');
      recargar();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo registrar tu respuesta.');
    }
  }

  async function votar(votacion: VotacionDetalle, opcionId: string, unidadId: string) {
    await votacionesService.votar(votacion.id, opcionId, unidadId);
    toast.success('Voto registrado');
    setVotando(null);
    recargar();
  }

  const proximas = (asambleas ?? []).filter((a) => !CERRADAS.includes(a.estado));
  const anteriores = (asambleas ?? []).filter((a) => CERRADAS.includes(a.estado));
  const abiertas = (votaciones ?? []).filter((v) => v.estado === 'ABIERTA');
  const cerradas = (votaciones ?? []).filter((v) => v.estado === 'CERRADA');
  const porVotar = abiertas.filter((v) => detallesVotacion[v.id]?.misUnidades?.some((u) => !u.voto)).length;

  return (
    <div className="flex flex-col gap-3">
      <PageHeader titulo="Asambleas y votaciones" volverA="/vecino" />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!error && (
        <Tabs defaultValue="asambleas">
          <TabsList className="w-full">
            <TabsTrigger value="asambleas">Asambleas</TabsTrigger>
            <TabsTrigger value="votaciones">
              Votaciones
              {porVotar > 0 && (
                <span className="ml-1.5 rounded-full bg-primary px-1.5 text-xs text-primary-foreground tabular-nums">
                  {porVotar}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="asambleas" className="mt-3 flex flex-col gap-3">
            {!asambleas ? (
              <>
                <TarjetaAsambleaVecinoEsqueleto />
                <TarjetaAsambleaVecinoEsqueleto />
              </>
            ) : asambleas.length === 0 ? (
              <EmptyState
                icono={Landmark}
                titulo="No hay asambleas"
                descripcion="Cuando la administración convoque una, la vas a ver acá para confirmar tu asistencia."
              />
            ) : (
              <>
                {proximas.map((a) => (
                  <TarjetaAsambleaVecino
                    key={a.id}
                    asamblea={a}
                    detalle={detallesAsamblea[a.id]}
                    unidadId={unidad.id}
                    onResponder={(estado) => responder(a, estado)}
                  />
                ))}
                {anteriores.length > 0 && (
                  <>
                    <h2 className="mt-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                      Anteriores
                    </h2>
                    {anteriores.map((a) => (
                      <TarjetaAsambleaVecino
                        key={a.id}
                        asamblea={a}
                        detalle={detallesAsamblea[a.id]}
                        unidadId={unidad.id}
                        onResponder={(estado) => responder(a, estado)}
                      />
                    ))}
                  </>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="votaciones" className="mt-3 flex flex-col gap-3">
            {!votaciones ? (
              <>
                <TarjetaAsambleaVecinoEsqueleto />
                <TarjetaAsambleaVecinoEsqueleto />
              </>
            ) : votaciones.length === 0 ? (
              <EmptyState
                icono={Vote}
                titulo="No hay votaciones"
                descripcion="Cuando haya algo para decidir entre los vecinos, vas a poder votar desde acá."
              />
            ) : (
              <>
                {abiertas.map((v) => (
                  <TarjetaVotacionVecino key={v.id} votacion={v} detalle={detallesVotacion[v.id]} onVotar={setVotando} />
                ))}
                {cerradas.length > 0 && (
                  <>
                    <h2 className="mt-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                      Cerradas
                    </h2>
                    {cerradas.map((v) => (
                      <TarjetaVotacionVecino
                        key={v.id}
                        votacion={v}
                        detalle={detallesVotacion[v.id]}
                        onVotar={setVotando}
                      />
                    ))}
                  </>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      )}

      {votando && (
        <DialogoVotar
          votacion={votando}
          unidadActivaId={unidad.id}
          onVotar={(opcionId, unidadId) => votar(votando, opcionId, unidadId)}
          onCerrar={() => setVotando(null)}
        />
      )}
    </div>
  );
}
