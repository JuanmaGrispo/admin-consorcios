'use client';

import { CircleCheck, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { IconoCatalogo } from '@/components/catalogos/icono-catalogo';
import { EmptyState } from '@/components/empty-state';
import { EstadoBadge } from '@/components/estado-badge';
import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUnidadActiva } from '@/components/vecino/unidad-activa';
import { usePedido } from '@/hooks/use-pedido';
import { fecha, haceCuanto } from '@/lib/formato';
import { reclamosService } from '@/services/reclamos';
import type { Reclamo } from '@/types/reclamo';

type Solapa = 'todos' | 'abiertos' | 'cerrados';

const POR_PAGINA = 20;

/** Pantalla 13 del prototipo: los reclamos de la unidad, con solapas Todos / Abiertos / Cerrados. */
export default function VecinoReclamosPage() {
  const { unidad } = useUnidadActiva();
  const [solapa, setSolapa] = useState<Solapa>('todos');
  const [limite, setLimite] = useState(POR_PAGINA);

  const pedido = usePedido(`${unidad.id}:${solapa}:${limite}`, () =>
    reclamosService.listar({
      unidadId: unidad.id,
      situacion: solapa === 'todos' ? undefined : solapa,
      limite,
    }),
  );
  const { error, cargando } = pedido;
  // Con "Ver más" la lista que ya está no desaparece mientras llega la más larga.
  const datos = pedido.datos ?? (limite > POR_PAGINA ? pedido.ultimo : undefined);

  function cambiarSolapa(valor: string) {
    setSolapa(valor as Solapa);
    setLimite(POR_PAGINA);
  }

  const nuevo = (
    <Button asChild size="icon" variant="ghost" className="text-primary" aria-label="Nuevo reclamo">
      <Link href="/vecino/reclamos/nuevo">
        <Plus className="size-5" />
      </Link>
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader titulo="Mis reclamos" contexto={`Unidad ${unidad.etiqueta}`} volverA="/vecino" acciones={nuevo} />

      <Tabs value={solapa} onValueChange={cambiarSolapa}>
        <TabsList className="w-full">
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="abiertos">Abiertos</TabsTrigger>
          <TabsTrigger value="cerrados">Cerrados</TabsTrigger>
        </TabsList>
      </Tabs>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!datos && !error && <EsqueletoLista />}

      {datos && datos.items.length === 0 && (
        <EmptyState
          icono={CircleCheck}
          titulo={solapa === 'cerrados' ? 'Todavía no hay reclamos cerrados' : 'No tenés reclamos'}
          descripcion={
            solapa === 'cerrados'
              ? 'Cuando la administración resuelva un reclamo tuyo, lo vas a ver acá.'
              : 'Si hay algo roto o algo que molesta en el edificio, avisale a la administración y seguí el estado desde acá.'
          }
          accion={
            solapa !== 'cerrados' && (
              <Button asChild className="w-full sm:w-auto">
                <Link href="/vecino/reclamos/nuevo">
                  <Plus />
                  Crear un reclamo
                </Link>
              </Button>
            )
          }
        />
      )}

      {datos && datos.items.length > 0 && (
        <ul className="flex flex-col gap-3">
          {datos.items.map((reclamo) => (
            <li key={reclamo.id}>
              <TarjetaReclamo reclamo={reclamo} />
            </li>
          ))}
        </ul>
      )}

      {datos && datos.total > datos.items.length && (
        <Button variant="outline" disabled={cargando} onClick={() => setLimite((l) => l + POR_PAGINA)}>
          {cargando ? 'Cargando…' : 'Ver más'}
        </Button>
      )}
    </div>
  );
}

function TarjetaReclamo({ reclamo }: { reclamo: Reclamo }) {
  const pie =
    reclamo.estado === 'RESUELTO' && reclamo.cerradoAt
      ? `Cerrado el ${fecha(reclamo.cerradoAt)}`
      : `Abierto ${haceCuanto(reclamo.createdAt)}`;

  return (
    <Link href={`/vecino/reclamos/${reclamo.id}`} className="block rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
      <Card className="py-4 transition-colors hover:bg-muted">
        <CardContent className="flex flex-col gap-1.5 px-4">
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              <IconoCatalogo nombre={reclamo.categoria?.icono} />
              <span className="truncate">{reclamo.categoria?.nombre ?? 'Sin categoría'}</span>
            </span>
            <EstadoBadge dominio="reclamo" estado={reclamo.estado} />
          </div>
          <p className="line-clamp-2 text-sm font-semibold">{reclamo.descripcion}</p>
          <p className="text-xs text-muted-foreground">
            {pie} · {reclamo.codigo}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

function EsqueletoLista() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="py-4">
          <CardContent className="flex flex-col gap-2 px-4">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-40" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
