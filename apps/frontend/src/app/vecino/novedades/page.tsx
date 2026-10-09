'use client';

import { Megaphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { NovedadCard, NovedadCardEsqueleto } from '@/components/novedades/novedad-card';
import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useUnidadActiva } from '@/components/vecino/unidad-activa';
import { ApiError } from '@/lib/api';
import { novedadesService } from '@/services/novedades';
import type { Consorcio } from '@/types/consorcio';
import type { Novedad } from '@/types/novedad';

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
  const [novedades, setNovedades] = useState<Novedad[] | null>(null);
  const [pagina, setPagina] = useState(1);
  const [paginas, setPaginas] = useState(1);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function agregar(items: Novedad[], datos: { pagina: number; paginas: number }) {
    setNovedades((prev) => [...(prev ?? []), ...items]);
    setPagina(datos.pagina);
    setPaginas(datos.paginas);
    // Si el aviso falla no pasa nada: se vuelve a avisar la próxima vez que la vea.
    for (const n of items) {
      if (!n.leida) void novedadesService.marcarLeida(n.id).catch(() => undefined);
    }
  }

  useEffect(() => {
    let vigente = true;
    novedadesService
      .listar({ consorcioId: consorcio.id })
      .then((r) => vigente && agregar(r.items, r))
      .catch((err) => {
        if (vigente) setError(err instanceof ApiError ? err.message : 'No se pudo cargar el muro.');
      });
    return () => {
      vigente = false;
    };
  }, [consorcio.id]);

  async function verAnteriores() {
    setCargandoMas(true);
    setError(null);
    try {
      const r = await novedadesService.listar({ consorcioId: consorcio.id, pagina: pagina + 1 });
      agregar(r.items, r);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar más novedades.');
    } finally {
      setCargandoMas(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <PageHeader titulo="Novedades" volverA="/vecino" />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!novedades ? (
        !error && (
          <>
            <NovedadCardEsqueleto />
            <NovedadCardEsqueleto />
          </>
        )
      ) : novedades.length === 0 ? (
        <EmptyState
          icono={Megaphone}
          titulo="No hay novedades"
          descripcion="Cuando la administración publique un aviso del edificio, lo vas a ver acá."
        />
      ) : (
        <>
          {novedades.map((n) => (
            <NovedadCard key={n.id} novedad={n} />
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
