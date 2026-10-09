'use client';

import { Megaphone } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { NovedadCard, NovedadCardEsqueleto } from '@/components/novedades/novedad-card';
import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useUnidadActiva } from '@/components/vecino/unidad-activa';
import { usePedido } from '@/hooks/use-pedido';
import { novedadesService } from '@/services/novedades';
import type { Consorcio } from '@/types/consorcio';

const POR_PAGINA = 20;
/** El backend no devuelve más de 100 por pedido. */
const LIMITE_MAXIMO = 100;

export default function VecinoNovedadesPage() {
  const { consorcio } = useUnidadActiva();
  // Una unidad de otro edificio es otro muro: arranca de cero.
  return <Muro key={consorcio.id} consorcio={consorcio} />;
}

/**
 * El muro del edificio de la unidad activa (pantalla 16). Lo que estaba sin
 * leer se marca leído al mostrarlo: es lo que cuenta el "leída por" del
 * administrador.
 */
function Muro({ consorcio }: { consorcio: Consorcio }) {
  const [limite, setLimite] = useState(POR_PAGINA);
  const pedido = usePedido(
    `muro:${limite}`,
    () => novedadesService.listar({ consorcioId: consorcio.id, limite }),
    'No se pudo cargar el muro.',
  );
  // "Ver anteriores" pide una página más larga: mientras llega, sigue la lista de antes.
  const datos = pedido.datos ?? (limite > POR_PAGINA ? pedido.ultimo : undefined);

  // Avisa que se vieron, una sola vez por novedad. Si falla no pasa nada:
  // la próxima vez que la vea se vuelve a avisar.
  const avisadas = useRef(new Set<string>());
  useEffect(() => {
    for (const n of datos?.items ?? []) {
      if (n.leida || avisadas.current.has(n.id)) continue;
      avisadas.current.add(n.id);
      void novedadesService.marcarLeida(n.id).catch(() => undefined);
    }
  }, [datos]);

  return (
    <div className="flex flex-col gap-3">
      <PageHeader titulo="Novedades" volverA="/vecino" />

      {pedido.error && (
        <Alert variant="destructive">
          <AlertDescription>{pedido.error}</AlertDescription>
        </Alert>
      )}

      {!datos ? (
        !pedido.error && (
          <>
            <NovedadCardEsqueleto />
            <NovedadCardEsqueleto />
          </>
        )
      ) : datos.items.length === 0 ? (
        <EmptyState
          icono={Megaphone}
          titulo="No hay novedades"
          descripcion="Cuando la administración publique un aviso del edificio, lo vas a ver acá."
        />
      ) : (
        <>
          {datos.items.map((n) => (
            <NovedadCard key={n.id} novedad={n} />
          ))}
          {datos.total > datos.items.length && limite < LIMITE_MAXIMO && (
            <Button
              variant="outline"
              onClick={() => setLimite((l) => Math.min(l + POR_PAGINA, LIMITE_MAXIMO))}
              disabled={pedido.cargando}
              className="self-center"
            >
              {pedido.cargando ? 'Cargando…' : 'Ver anteriores'}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
