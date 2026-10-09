'use client';

import { Plus, Vote } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useConsorcioActivo } from '@/components/admin/consorcio-activo';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { DetalleVotacionAdmin } from '@/components/votaciones/detalle-votacion-admin';
import { TablaVotaciones, TablaVotacionesEsqueleto } from '@/components/votaciones/tabla-votaciones';
import { VotacionDialog, type ValoresVotacion } from '@/components/votaciones/votacion-dialog';
import { usePedido } from '@/hooks/use-pedido';
import { votacionesService } from '@/services/votaciones';
import type { Consorcio } from '@/types/consorcio';
import type { EstadoVotacion, Votacion } from '@/types/votacion';

type Filtro = 'TODAS' | EstadoVotacion;

/** Qué tiene abierto el diálogo: nada, un alta o la edición de un borrador. */
type Edicion = { modo: 'cerrado' } | { modo: 'alta' } | { modo: 'edicion'; votacion: Votacion };

const FILTROS: { valor: Filtro; etiqueta: string }[] = [
  { valor: 'TODAS', etiqueta: 'Todas' },
  { valor: 'ABIERTA', etiqueta: 'Abiertas' },
  { valor: 'BORRADOR', etiqueta: 'Borradores' },
  { valor: 'CERRADA', etiqueta: 'Cerradas' },
];

export default function AdminVotacionesPage() {
  const { consorcio } = useConsorcioActivo();
  // Otro edificio arranca de cero: sin filtro ni la lista anterior.
  return <VotacionesAdministradas key={consorcio.id} consorcio={consorcio} />;
}

/** Las votaciones del consorcio activo: crear, publicar, cerrar y seguir el conteo. */
function VotacionesAdministradas({ consorcio }: { consorcio: Consorcio }) {
  const [filtro, setFiltro] = useState<Filtro>('TODAS');
  const [edicion, setEdicion] = useState<Edicion>({ modo: 'cerrado' });
  // Se guarda el id: la votación que muestra el panel sale siempre de la lista recién pedida.
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);

  const pedido = usePedido(
    `votaciones:${consorcio.id}`,
    () => votacionesService.listar({ consorcioId: consorcio.id }),
    'No se pudieron cargar las votaciones.',
  );
  const votaciones = pedido.datos ?? null;
  const error = pedido.error ?? null;
  const seleccionada = votaciones?.find((v) => v.id === seleccionadaId) ?? null;

  async function guardar(valores: ValoresVotacion) {
    const { opciones, apertura, cierre, ...resto } = valores;
    if (edicion.modo === 'edicion') {
      const { id } = edicion.votacion;
      await votacionesService.actualizar(id, { ...resto, apertura, cierre });
      await votacionesService.reemplazarOpciones(id, opciones);
      toast.success('Votación actualizada');
    } else {
      await votacionesService.crear({ consorcioId: consorcio.id, ...resto, apertura, cierre, opciones });
      toast.success('Votación creada en borrador');
    }
    setEdicion({ modo: 'cerrado' });
    pedido.recargar();
  }

  const cantidad = (estado: EstadoVotacion) => votaciones?.filter((v) => v.estado === estado).length ?? 0;
  const visibles = votaciones?.filter((v) => filtro === 'TODAS' || v.estado === filtro) ?? [];

  const nueva = (
    <Button onClick={() => setEdicion({ modo: 'alta' })}>
      <Plus data-icon="inline-start" />
      Nueva votación
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        titulo="Votaciones"
        contexto={[consorcio.nombre, consorcio.barrio].filter(Boolean).join(' · ')}
        descripcion={
          votaciones
            ? `${cantidad('ABIERTA')} abiertas · ${cantidad('BORRADOR')} en borrador · ${cantidad('CERRADA')} cerradas`
            : 'Consultas a los vecinos, sueltas o dentro de una asamblea.'
        }
        acciones={nueva}
      />

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : votaciones && votaciones.length === 0 ? (
        <EmptyState
          icono={Vote}
          titulo="Todavía no hay votaciones"
          descripcion="Creá una consulta para los vecinos: una obra, un presupuesto, un cambio de reglamento."
          accion={nueva}
        />
      ) : (
        <Card className="gap-0 py-0">
          <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
            <ToggleGroup
              type="single"
              spacing={1}
              value={filtro}
              onValueChange={(valor) => valor && setFiltro(valor as Filtro)}
              className="rounded-lg border bg-muted p-0.5"
            >
              {FILTROS.map((f) => (
                <ToggleGroupItem
                  key={f.valor}
                  value={f.valor}
                  size="sm"
                  className="px-3 data-[state=on]:bg-card data-[state=on]:font-semibold data-[state=on]:shadow-xs"
                >
                  {f.etiqueta}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {!votaciones ? (
            <TablaVotacionesEsqueleto />
          ) : visibles.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              No hay votaciones con ese estado.
            </p>
          ) : (
            <TablaVotaciones votaciones={visibles} onVer={(v) => setSeleccionadaId(v.id)} />
          )}
        </Card>
      )}

      <DetalleVotacionAdmin
        votacion={seleccionada}
        onCerrar={() => setSeleccionadaId(null)}
        onEditar={(votacion) => {
          setSeleccionadaId(null);
          setEdicion({ modo: 'edicion', votacion });
        }}
        onCambio={pedido.recargar}
      />

      {edicion.modo !== 'cerrado' && (
        <VotacionDialog
          abierto
          onOpenChange={(abierto) => !abierto && setEdicion({ modo: 'cerrado' })}
          consorcioId={consorcio.id}
          subtitulo={
            consorcio.cantidadUnidades
              ? `${consorcio.nombre} · ${consorcio.cantidadUnidades} unidades`
              : consorcio.nombre
          }
          votacion={edicion.modo === 'edicion' ? edicion.votacion : undefined}
          onGuardar={guardar}
        />
      )}
    </div>
  );
}
