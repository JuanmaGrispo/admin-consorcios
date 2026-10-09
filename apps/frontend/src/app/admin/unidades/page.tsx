'use client';

import { Building, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useConsorcioActivo } from '@/components/admin/consorcio-activo';
import { ConfirmarAccion } from '@/components/confirmar-accion';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { sumaCoeficientes } from '@/components/unidades/etiquetas';
import { PanelVecinos } from '@/components/unidades/panel-vecinos';
import { TablaUnidades, TablaUnidadesEsqueleto } from '@/components/unidades/tabla-unidades';
import { UnidadDialog, type ValoresUnidad } from '@/components/unidades/unidad-dialog';
import { usePedido } from '@/hooks/use-pedido';
import { ApiError } from '@/lib/api';
import { porcentaje } from '@/lib/formato';
import { unidadesService } from '@/services/unidades';
import type { Consorcio } from '@/types/consorcio';
import type { Unidad } from '@/types/unidad';

type Filtro = 'activas' | 'todas';

/** Qué tiene abierto el diálogo: nada, un alta o la edición de una unidad. */
type Edicion = { modo: 'cerrado' } | { modo: 'alta' } | { modo: 'edicion'; unidad: Unidad };

export default function AdminUnidadesPage() {
  const { consorcio } = useConsorcioActivo();
  // Otro edificio arranca de cero: sin filtro ni la lista anterior.
  return <UnidadesDelConsorcio key={consorcio.id} consorcio={consorcio} />;
}

/** Las unidades funcionales del consorcio activo, con sus coeficientes y quién vive en cada una. */
function UnidadesDelConsorcio({ consorcio }: { consorcio: Consorcio }) {
  const [filtro, setFiltro] = useState<Filtro>('activas');
  const [edicion, setEdicion] = useState<Edicion>({ modo: 'cerrado' });
  const [aDarDeBaja, setADarDeBaja] = useState<Unidad | null>(null);
  // Se guarda el id: la unidad del panel sale siempre de la lista recién pedida.
  const [vecinosDe, setVecinosDe] = useState<string | null>(null);

  // Se piden todas una sola vez: el filtro y la suma de coeficientes salen de la misma lista.
  const pedido = usePedido(
    `unidades:${consorcio.id}`,
    () => unidadesService.listar({ consorcioId: consorcio.id, incluirInactivas: true }),
    'No se pudieron cargar las unidades.',
  );
  const todas = pedido.datos ?? pedido.ultimo ?? null;
  const activas = todas?.filter((u) => u.activa) ?? [];
  const visibles = filtro === 'activas' ? activas : (todas ?? []);
  const asignado = sumaCoeficientes(activas.map((u) => u.coeficiente));
  const seleccionada = todas?.find((u) => u.id === vecinosDe) ?? null;

  /** Lo que queda del 100% sin contar la unidad que se edita (si está activa). */
  function libreSin(unidad?: Unidad): number {
    const propio = unidad?.activa ? unidad.coeficiente : 0;
    return sumaCoeficientes([100, -asignado, propio]);
  }

  async function guardar(valores: ValoresUnidad) {
    if (edicion.modo === 'edicion') {
      await unidadesService.actualizar(edicion.unidad.id, valores);
      toast.success('Unidad actualizada');
    } else {
      await unidadesService.crear({ consorcioId: consorcio.id, ...valores });
      toast.success('Unidad creada');
    }
    setEdicion({ modo: 'cerrado' });
    pedido.recargar();
  }

  async function cambiarActiva(unidad: Unidad, activa: boolean) {
    if (!activa) {
      setADarDeBaja(unidad);
      return;
    }
    try {
      await unidadesService.actualizar(unidad.id, { activa: true });
      toast.success(`${unidad.etiqueta} reactivada`);
      pedido.recargar();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo reactivar la unidad.');
    }
  }

  const nueva = (
    <Button onClick={() => setEdicion({ modo: 'alta' })}>
      <Plus data-icon="inline-start" />
      Nueva unidad
    </Button>
  );

  const completo = Math.abs(asignado - 100) < 0.0001;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        titulo="Unidades"
        contexto={[consorcio.nombre, consorcio.barrio].filter(Boolean).join(' · ')}
        descripcion={
          todas
            ? `${activas.length} ${activas.length === 1 ? 'unidad activa' : 'unidades activas'} · coeficientes ${porcentaje(asignado, 4)} de 100%`
            : 'Las unidades funcionales del edificio y quién vive en cada una.'
        }
        acciones={nueva}
      />

      {todas && todas.length > 0 && !completo && (
        <Alert>
          <AlertDescription>
            Los coeficientes de las unidades activas suman {porcentaje(asignado, 4)}. Hasta que lleguen al 100%,
            el prorrateo de expensas no reparte el total completo.
          </AlertDescription>
        </Alert>
      )}

      {pedido.error ? (
        <Alert variant="destructive">
          <AlertDescription>{pedido.error}</AlertDescription>
        </Alert>
      ) : todas && todas.length === 0 ? (
        <EmptyState
          icono={Building}
          titulo="Todavía no hay unidades"
          descripcion="Cargá los departamentos, locales y cocheras con su coeficiente. Después sumá a los vecinos de cada uno."
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
              <Opcion valor="activas" etiqueta="Activas" cantidad={todas ? activas.length : undefined} />
              <Opcion valor="todas" etiqueta="Todas" cantidad={todas?.length} />
            </ToggleGroup>
          </div>

          {!todas ? (
            <TablaUnidadesEsqueleto />
          ) : visibles.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              No hay unidades activas: las dadas de baja están en “Todas”.
            </p>
          ) : (
            <TablaUnidades
              unidades={visibles}
              onVecinos={(u) => setVecinosDe(u.id)}
              onEditar={(unidad) => setEdicion({ modo: 'edicion', unidad })}
              onCambiarActiva={cambiarActiva}
            />
          )}
        </Card>
      )}

      <PanelVecinos unidad={seleccionada} onCerrar={() => setVecinosDe(null)} onCambio={pedido.recargar} />

      {edicion.modo !== 'cerrado' && (
        <UnidadDialog
          abierto
          onOpenChange={(abierto) => !abierto && setEdicion({ modo: 'cerrado' })}
          subtitulo={consorcio.nombre}
          unidad={edicion.modo === 'edicion' ? edicion.unidad : undefined}
          coeficienteLibre={libreSin(edicion.modo === 'edicion' ? edicion.unidad : undefined)}
          onGuardar={guardar}
        />
      )}

      <ConfirmarAccion
        abierto={aDarDeBaja !== null}
        titulo={`¿Dar de baja ${aDarDeBaja?.etiqueta ?? ''}?`}
        descripcion="Deja de recibir expensas y no se le pueden sumar vecinos. Su historia (boletas, reclamos) queda. Se puede reactivar."
        boton="Dar de baja"
        onConfirmar={async () => {
          if (!aDarDeBaja) return;
          await unidadesService.actualizar(aDarDeBaja.id, { activa: false });
          toast.success(`${aDarDeBaja.etiqueta} dada de baja`);
          pedido.recargar();
        }}
        onCerrar={() => setADarDeBaja(null)}
      />
    </div>
  );
}

/** Una opción del filtro segmentado, con su cantidad atenuada. */
function Opcion({ valor, etiqueta, cantidad }: { valor: Filtro; etiqueta: string; cantidad?: number }) {
  return (
    <ToggleGroupItem
      value={valor}
      size="sm"
      className="px-3 data-[state=on]:bg-card data-[state=on]:font-semibold data-[state=on]:shadow-xs"
    >
      {etiqueta}
      {cantidad !== undefined && <span className="tabular-nums opacity-60">{cantidad}</span>}
    </ToggleGroupItem>
  );
}
