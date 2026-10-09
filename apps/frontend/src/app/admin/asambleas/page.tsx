'use client';

import { Landmark, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { useConsorcioActivo } from '@/components/admin/consorcio-activo';
import { AsambleaDialog, type ValoresAsamblea } from '@/components/asambleas/asamblea-dialog';
import { TablaAsambleas, TablaAsambleasEsqueleto } from '@/components/asambleas/tabla-asambleas';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { usePedido } from '@/hooks/use-pedido';
import { asambleasService } from '@/services/asambleas';
import type { Consorcio } from '@/types/consorcio';

type Filtro = 'TODAS' | 'PROXIMAS' | 'CERRADAS';

const FILTROS: { valor: Filtro; etiqueta: string }[] = [
  { valor: 'TODAS', etiqueta: 'Todas' },
  { valor: 'PROXIMAS', etiqueta: 'Próximas' },
  { valor: 'CERRADAS', etiqueta: 'Cerradas' },
];

const CERRADAS = ['CERRADA', 'CERRADA_SIN_QUORUM'];

export default function AdminAsambleasPage() {
  const { consorcio } = useConsorcioActivo();
  // Otro edificio arranca de cero: sin filtro ni la lista anterior.
  return <AsambleasAdministradas key={consorcio.id} consorcio={consorcio} />;
}

/** Las asambleas del consorcio activo: crear una y entrar al detalle para llevarla adelante. */
function AsambleasAdministradas({ consorcio }: { consorcio: Consorcio }) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<Filtro>('TODAS');
  const [creando, setCreando] = useState(false);

  const pedido = usePedido(
    `asambleas:${consorcio.id}`,
    () => asambleasService.listar({ consorcioId: consorcio.id }),
    'No se pudieron cargar las asambleas.',
  );
  const asambleas = pedido.datos ?? null;
  const error = pedido.error ?? null;

  async function crear(valores: ValoresAsamblea) {
    const { id } = await asambleasService.crear({ consorcioId: consorcio.id, ...valores });
    toast.success('Asamblea creada en borrador');
    // Lo que sigue es completarla y convocarla: se va directo al detalle.
    router.push(`/admin/asambleas/${id}`);
  }

  const visibles = (asambleas ?? []).filter((a) =>
    filtro === 'TODAS' ? true : filtro === 'CERRADAS' ? CERRADAS.includes(a.estado) : !CERRADAS.includes(a.estado),
  );
  const cantidad = (f: Filtro) =>
    (asambleas ?? []).filter((a) =>
      f === 'TODAS' ? true : f === 'CERRADAS' ? CERRADAS.includes(a.estado) : !CERRADAS.includes(a.estado),
    ).length;

  const nueva = (
    <Button onClick={() => setCreando(true)}>
      <Plus data-icon="inline-start" />
      Nueva asamblea
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        titulo="Asambleas"
        contexto={[consorcio.nombre, consorcio.barrio].filter(Boolean).join(' · ')}
        descripcion={
          asambleas
            ? `${cantidad('PROXIMAS')} en curso o por hacerse · ${cantidad('CERRADAS')} cerradas`
            : 'Convocá, llevá el quórum y dejá el acta del edificio.'
        }
        acciones={nueva}
      />

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : asambleas && asambleas.length === 0 ? (
        <EmptyState
          icono={Landmark}
          titulo="Todavía no hay asambleas"
          descripcion="Armá la primera: fecha, orden del día y quórum. Los vecinos la ven cuando la convoques."
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
                  {asambleas && <span className="tabular-nums opacity-60">{cantidad(f.valor)}</span>}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {!asambleas ? (
            <TablaAsambleasEsqueleto />
          ) : visibles.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              No hay asambleas en este filtro.
            </p>
          ) : (
            <TablaAsambleas asambleas={visibles} />
          )}
        </Card>
      )}

      {creando && (
        <AsambleaDialog
          abierto
          onOpenChange={(abierto) => !abierto && setCreando(false)}
          subtitulo={
            consorcio.cantidadUnidades
              ? `${consorcio.nombre} · ${consorcio.cantidadUnidades} unidades`
              : consorcio.nombre
          }
          onGuardar={crear}
        />
      )}
    </div>
  );
}
