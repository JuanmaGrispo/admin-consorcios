'use client';

import { List, Plus, SquareKanban, X } from 'lucide-react';
import { useState } from 'react';
import { useConsorcioActivo } from '@/components/admin/consorcio-activo';
import { PageHeader } from '@/components/page-header';
import { DetalleReclamoAdmin } from '@/components/reclamos/detalle-reclamo-admin';
import { DialogoNuevoReclamo } from '@/components/reclamos/dialogo-nuevo-reclamo';
import { ListaReclamos } from '@/components/reclamos/lista-reclamos';
import { TableroReclamos } from '@/components/reclamos/tablero-reclamos';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useMediaQuery } from '@/hooks/use-media-query';
import { usePedido } from '@/hooks/use-pedido';
import { domicilio } from '@/lib/formato';
import { categoriasReclamoService } from '@/services/categorias-reclamo';
import { reclamosService } from '@/services/reclamos';
import { ESTADOS_RECLAMO, type EstadoReclamo, type Reclamo, type ResumenReclamos } from '@/types/reclamo';

type Vista = 'tablero' | 'lista';

/** Cuántos trae cada columna del tablero. De los resueltos alcanza con los últimos. */
const POR_COLUMNA: Record<EstadoReclamo, number> = {
  NUEVO: 50,
  EN_CURSO: 50,
  ESPERANDO_PROVEEDOR: 50,
  RESUELTO: 10,
};

function descripcionDe(resumen: ResumenReclamos): string {
  const partes = [
    `${resumen.abiertos} ${resumen.abiertos === 1 ? 'abierto' : 'abiertos'}`,
    `${resumen.porEstado.ESPERANDO_PROVEEDOR} esperando proveedor`,
  ];
  if (resumen.diasPromedioResolucion !== null) {
    partes.push(
      `tiempo medio de resolución ${resumen.diasPromedioResolucion.toLocaleString('es-AR')} días`,
    );
  }
  return partes.join(' · ');
}

/** Pantalla 04 del prototipo: bandeja de reclamos con tablero, lista y detalle lateral. */
export default function AdminReclamosPage() {
  const { consorcio } = useConsorcioActivo();
  const [vista, setVista] = useState<Vista>('tablero');
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  // La lista pide sola según sus filtros; esto la obliga a volver a pedir tras una gestión.
  const [versionLista, setVersionLista] = useState(0);
  // Con el tablero y el detalle lado a lado hacen falta ~1280px; si no, el detalle va en un Sheet.
  const ancho = useMediaQuery('(min-width: 1280px)');

  const resumen = usePedido(`resumen:${consorcio.id}`, () => reclamosService.resumen(consorcio.id));
  const categorias = usePedido(`categorias:${consorcio.id}`, () =>
    categoriasReclamoService.listar(consorcio.id),
  );
  const tablero = usePedido(
    vista === 'tablero' ? `tablero:${consorcio.id}` : null,
    async () => {
      const listas = await Promise.all(
        ESTADOS_RECLAMO.map((estado) =>
          reclamosService.listar({ consorcioId: consorcio.id, estado, limite: POR_COLUMNA[estado] }),
        ),
      );
      return Object.fromEntries(ESTADOS_RECLAMO.map((e, i) => [e, listas[i].items])) as Record<
        EstadoReclamo,
        Reclamo[]
      >;
    },
    'No se pudieron cargar los reclamos.',
  );

  // Al cambiar de consorcio, el reclamo abierto es de otro edificio.
  const [consorcioDelSeleccionado, setConsorcioDelSeleccionado] = useState(consorcio.id);
  if (consorcioDelSeleccionado !== consorcio.id) {
    setConsorcioDelSeleccionado(consorcio.id);
    setSeleccionado(null);
  }

  function refrescar() {
    resumen.recargar();
    tablero.recargar();
    setVersionLista((v) => v + 1);
  }

  const detalle = seleccionado && (
    <DetalleReclamoAdmin key={seleccionado} reclamoId={seleccionado} onCambio={refrescar} />
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        contexto={[domicilio(consorcio.calle, consorcio.numero), consorcio.barrio].filter(Boolean).join(' · ') || consorcio.nombre}
        titulo="Reclamos"
        descripcion={resumen.datos ? descripcionDe(resumen.datos) : undefined}
        acciones={
          <>
            <ToggleGroup
              type="single"
              variant="outline"
              spacing={0}
              value={vista}
              onValueChange={(v) => v && setVista(v as Vista)}
              aria-label="Vista"
            >
              <ToggleGroupItem value="tablero" className="bg-card px-3">
                <SquareKanban />
                Tablero
              </ToggleGroupItem>
              <ToggleGroupItem value="lista" className="bg-card px-3">
                <List />
                Lista
              </ToggleGroupItem>
            </ToggleGroup>
            <Button onClick={() => setCreando(true)}>
              <Plus />
              Nuevo reclamo
            </Button>
          </>
        }
      />

      {tablero.error && (
        <Alert variant="destructive">
          <AlertDescription>{tablero.error}</AlertDescription>
        </Alert>
      )}

      <div
        className={
          seleccionado && ancho ? 'grid items-start gap-4 grid-cols-[minmax(0,1fr)_380px]' : 'flex flex-col'
        }
      >
        <div className="min-w-0">
          {vista === 'tablero' ? (
            <TableroReclamos
              columnas={tablero.datos}
              totales={resumen.datos?.porEstado}
              seleccionado={seleccionado}
              onSeleccionar={setSeleccionado}
            />
          ) : (
            <ListaReclamos
              consorcioId={consorcio.id}
              version={versionLista}
              categorias={categorias.datos ?? []}
              seleccionado={seleccionado}
              onSeleccionar={setSeleccionado}
            />
          )}
        </div>

        {seleccionado && ancho && (
          <Card className="sticky top-6 max-h-[calc(100svh-3rem)] overflow-y-auto py-4">
            <CardContent className="relative px-4">
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute -top-1 right-2"
                onClick={() => setSeleccionado(null)}
                aria-label="Cerrar detalle"
              >
                <X />
              </Button>
              <div className="pr-8">{detalle}</div>
            </CardContent>
          </Card>
        )}
      </div>

      <Sheet open={Boolean(seleccionado) && !ancho} onOpenChange={(abierto) => !abierto && setSeleccionado(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="pb-0">
            <SheetTitle>Detalle del reclamo</SheetTitle>
            <SheetDescription className="sr-only">Línea de tiempo, respuesta y gestión del reclamo.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">{!ancho && detalle}</div>
        </SheetContent>
      </Sheet>

      <DialogoNuevoReclamo
        consorcioId={consorcio.id}
        categorias={categorias.datos ?? []}
        abierto={creando}
        onAbiertoChange={setCreando}
        onCreado={(reclamo) => {
          refrescar();
          setSeleccionado(reclamo.id);
        }}
      />
    </div>
  );
}
