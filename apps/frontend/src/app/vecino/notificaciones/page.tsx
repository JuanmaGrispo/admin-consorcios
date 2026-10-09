'use client';

import { BellOff, CheckCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
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
import { ApiError } from '@/lib/api';
import { notificacionesService } from '@/services/notificaciones';
import type { Notificacion } from '@/types/notificacion';

/**
 * El centro de notificaciones del vecino (la lista de la pantalla 16, a la
 * que lleva la campana). Tocar un aviso lo marca leído y abre lo que avisa.
 */
export default function VecinoNotificacionesPage() {
  const router = useRouter();
  const [avisos, setAvisos] = useState<Notificacion[] | null>(null);
  const [noLeidas, setNoLeidas] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [paginas, setPaginas] = useState(1);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    notificacionesService
      .listar({ pagina: 1 })
      .then((r) => {
        if (!vigente) return;
        setAvisos(r.items);
        setNoLeidas(r.noLeidas);
        setPaginas(r.paginas);
      })
      .catch((err) => {
        if (vigente) setError(err instanceof ApiError ? err.message : 'No se pudieron cargar tus avisos.');
      });
    return () => {
      vigente = false;
    };
  }, []);

  async function verAnteriores() {
    setCargandoMas(true);
    try {
      const r = await notificacionesService.listar({ pagina: pagina + 1 });
      setAvisos((prev) => [...(prev ?? []), ...r.items]);
      setPagina(r.pagina);
      setPaginas(r.paginas);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudieron cargar más avisos.');
    } finally {
      setCargandoMas(false);
    }
  }

  /** Lo marca leído en pantalla y en el backend; si lleva a algún lado, va. */
  function abrir(n: Notificacion) {
    if (n.leidaAt === null) {
      setAvisos((prev) => prev?.map((a) => (a.id === n.id ? { ...a, leidaAt: new Date().toISOString() } : a)) ?? null);
      setNoLeidas((c) => Math.max(0, c - 1));
      void notificacionesService.marcarLeida(n.id).catch(() => undefined);
    }
    const destino = destinoDe(n);
    if (destino) router.push(destino);
  }

  async function marcarTodas() {
    try {
      await notificacionesService.marcarTodas();
      const ahora = new Date().toISOString();
      setAvisos((prev) => prev?.map((a) => (a.leidaAt ? a : { ...a, leidaAt: ahora })) ?? null);
      setNoLeidas(0);
      toast.success('Listo, no te queda nada sin leer');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudieron marcar.');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        titulo="Notificaciones"
        volverA="/vecino"
        descripcion={avisos && avisos.length > 0 ? (noLeidas ? `${noLeidas} sin leer` : 'Todo leído') : undefined}
        acciones={
          noLeidas > 0 && (
            <Button variant="outline" size="sm" onClick={marcarTodas}>
              <CheckCheck data-icon="inline-start" />
              Marcar todas como leídas
            </Button>
          )
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!avisos ? (
        !error && (
          <>
            <ItemNotificacionEsqueleto />
            <ItemNotificacionEsqueleto />
            <ItemNotificacionEsqueleto />
          </>
        )
      ) : avisos.length === 0 ? (
        <EmptyState
          icono={BellOff}
          titulo="No tenés avisos"
          descripcion="Acá te llegan las boletas, los cambios en tus reclamos y reservas, y las asambleas."
        />
      ) : (
        <>
          {avisos.map((n) => (
            <ItemNotificacion key={n.id} notificacion={n} onAbrir={() => abrir(n)} />
          ))}
          {pagina < paginas && (
            <Button variant="outline" onClick={verAnteriores} disabled={cargandoMas} className="self-center">
              {cargandoMas ? 'Cargando…' : 'Ver anteriores'}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
