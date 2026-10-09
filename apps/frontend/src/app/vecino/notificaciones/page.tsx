'use client';

import { BellOff, CheckCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import {
  destinoDe,
  ItemNotificacion,
  ItemNotificacionEsqueleto,
} from '@/components/notificaciones/item-notificacion';
import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { usePedido } from '@/hooks/use-pedido';
import { ApiError } from '@/lib/api';
import { notificacionesService } from '@/services/notificaciones';
import type { Notificacion } from '@/types/notificacion';

const POR_PAGINA = 20;
/** El backend no devuelve más de 100 por pedido. */
const LIMITE_MAXIMO = 100;

/**
 * El centro de notificaciones del vecino (la lista de la pantalla 16, a la
 * que lleva la campana). Tocar un aviso lo marca leído y abre lo que avisa.
 */
export default function VecinoNotificacionesPage() {
  const router = useRouter();
  const [limite, setLimite] = useState(POR_PAGINA);
  const pedido = usePedido(
    `avisos:${limite}`,
    () => notificacionesService.listar({ limite }),
    'No se pudieron cargar tus avisos.',
  );
  // "Ver anteriores" pide una página más larga: mientras llega, sigue la lista de antes.
  const datos = pedido.datos ?? (limite > POR_PAGINA ? pedido.ultimo : undefined);

  /** Lo marca leído y, si lleva a algún lado, va; si no, recarga para que se vea leído. */
  async function abrir(n: Notificacion) {
    const destino = destinoDe(n);
    if (n.leidaAt === null) {
      // Si falla no pasa nada: el aviso sigue sin leer y se puede volver a tocar.
      await notificacionesService.marcarLeida(n.id).catch(() => undefined);
      if (!destino) pedido.recargar();
    }
    if (destino) router.push(destino);
  }

  async function marcarTodas() {
    try {
      await notificacionesService.marcarTodas();
      pedido.recargar();
      toast.success('Listo, no te queda nada sin leer');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudieron marcar.');
    }
  }

  const noLeidas = datos?.noLeidas ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        titulo="Notificaciones"
        volverA="/vecino"
        descripcion={datos && datos.items.length > 0 ? (noLeidas ? `${noLeidas} sin leer` : 'Todo leído') : undefined}
        acciones={
          noLeidas > 0 && (
            <Button variant="outline" size="sm" onClick={marcarTodas}>
              <CheckCheck data-icon="inline-start" />
              Marcar todas como leídas
            </Button>
          )
        }
      />

      {pedido.error && (
        <Alert variant="destructive">
          <AlertDescription>{pedido.error}</AlertDescription>
        </Alert>
      )}

      {!datos ? (
        !pedido.error && (
          <>
            <ItemNotificacionEsqueleto />
            <ItemNotificacionEsqueleto />
            <ItemNotificacionEsqueleto />
          </>
        )
      ) : datos.items.length === 0 ? (
        <EmptyState
          icono={BellOff}
          titulo="No tenés avisos"
          descripcion="Acá te llegan las boletas, los cambios en tus reclamos y reservas, y las asambleas."
        />
      ) : (
        <>
          {datos.items.map((n) => (
            <ItemNotificacion key={n.id} notificacion={n} onAbrir={() => void abrir(n)} />
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
