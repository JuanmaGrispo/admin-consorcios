'use client';

import { Megaphone, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useConsorcioActivo } from '@/components/admin/consorcio-activo';
import { EmptyState } from '@/components/empty-state';
import { NovedadDialog, type ValoresNovedad } from '@/components/novedades/novedad-dialog';
import { TablaNovedades, TablaNovedadesEsqueleto } from '@/components/novedades/tabla-novedades';
import { PageHeader } from '@/components/page-header';
import { Paginacion } from '@/components/paginacion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ApiError } from '@/lib/api';
import { novedadesService } from '@/services/novedades';
import type { Paginado } from '@/types/comun';
import type { Consorcio } from '@/types/consorcio';
import type { Novedad, NovedadCambios } from '@/types/novedad';

/** Qué tiene abierto el diálogo: nada, un alta o la edición de una novedad. */
type Edicion = { modo: 'cerrado' } | { modo: 'alta' } | { modo: 'edicion'; novedad: Novedad };

type Filtro = 'publicadas' | 'todas';

/** "1 publicada", "4 publicadas", "1 dada de baja". */
function cantidad(n: number, palabra: string, resto = ''): string {
  return [n, n === 1 ? palabra : `${palabra}s`, resto].filter((x) => x !== '').join(' ');
}

/** El toast después de una acción rápida de la tabla. */
function confirmacion(cambios: NovedadCambios): string {
  if (cambios.activa === false) return 'Novedad dada de baja';
  if (cambios.activa) return 'Novedad publicada otra vez';
  return cambios.fijada ? 'Novedad fijada arriba' : 'Novedad desfijada';
}

export default function AdminNovedadesPage() {
  const { consorcio } = useConsorcioActivo();
  // Otro edificio arranca de cero: página 1, sin filtros ni la lista anterior.
  return <MuroAdministrado key={consorcio.id} consorcio={consorcio} />;
}

/** El muro del consorcio activo: publicar, editar, fijar y dar de baja. */
function MuroAdministrado({ consorcio }: { consorcio: Consorcio }) {
  const [pagina, setPagina] = useState(1);
  const [filtro, setFiltro] = useState<Filtro>('publicadas');
  const [datos, setDatos] = useState<Paginado<Novedad> | null>(null);
  const [conteo, setConteo] = useState<Record<Filtro, number> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edicion, setEdicion] = useState<Edicion>({ modo: 'cerrado' });
  // Sube después de cada cambio para volver a pedir la página actual.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vigente = true;
    novedadesService
      .listar({ consorcioId: consorcio.id, incluirInactivas: filtro === 'todas', pagina })
      .then((r) => {
        if (!vigente) return;
        setError(null);
        setDatos(r);
      })
      .catch((err) => {
        if (!vigente) return;
        setDatos(null);
        setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las novedades.');
      });
    // Si cambian los filtros antes de que llegue la respuesta, se descarta.
    return () => {
      vigente = false;
    };
  }, [consorcio.id, filtro, pagina, version]);

  // Los números del filtro y del encabezado: una página de uno alcanza, importa el total.
  useEffect(() => {
    let vigente = true;
    Promise.all([
      novedadesService.listar({ consorcioId: consorcio.id, limite: 1 }),
      novedadesService.listar({ consorcioId: consorcio.id, incluirInactivas: true, limite: 1 }),
    ])
      .then(([publicadas, todas]) => {
        if (vigente) setConteo({ publicadas: publicadas.total, todas: todas.total });
      })
      .catch(() => undefined); // Sin números el filtro anda igual.
    return () => {
      vigente = false;
    };
  }, [consorcio.id, version]);

  async function guardar({ titulo, cuerpo, fijada, adjuntos }: ValoresNovedad) {
    if (edicion.modo === 'edicion') {
      await novedadesService.actualizar(edicion.novedad.id, { titulo, cuerpo, fijada });
      toast.success('Novedad actualizada');
    } else {
      await novedadesService.crear({
        consorcioId: consorcio.id,
        titulo,
        cuerpo,
        fijada,
        adjuntos: adjuntos.length ? adjuntos : undefined,
      });
      toast.success('Novedad publicada');
      setPagina(1);
    }
    setEdicion({ modo: 'cerrado' });
    setVersion((v) => v + 1);
  }

  async function cambiar(novedad: Novedad, cambios: NovedadCambios) {
    try {
      await novedadesService.actualizar(novedad.id, cambios);
      toast.success(confirmacion(cambios));
      setVersion((v) => v + 1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo actualizar la novedad.');
    }
  }

  const nueva = (
    <Button onClick={() => setEdicion({ modo: 'alta' })}>
      <Plus data-icon="inline-start" />
      Nueva novedad
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        titulo="Novedades"
        contexto={[consorcio.nombre, consorcio.barrio].filter(Boolean).join(' · ')}
        descripcion={
          conteo
            ? `${cantidad(conteo.publicadas, 'publicada')} · ${cantidad(conteo.todas - conteo.publicadas, 'dada', 'de baja')}`
            : 'El muro del edificio: lo que publiques acá lo ven todos los vecinos.'
        }
        acciones={nueva}
      />

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : datos && datos.total === 0 && filtro === 'publicadas' && conteo?.todas === 0 ? (
        <EmptyState
          icono={Megaphone}
          titulo="Todavía no hay novedades"
          descripcion="Publicá un aviso para los vecinos: un corte de agua, un cambio de horario, el reglamento del SUM."
          accion={nueva}
        />
      ) : (
        <Card className="gap-0 py-0">
          <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
            <ToggleGroup
              type="single"
              spacing={1}
              value={filtro}
              onValueChange={(valor) => {
                if (!valor) return;
                setFiltro(valor as Filtro);
                setPagina(1);
              }}
              className="rounded-lg border bg-muted p-0.5"
            >
              <Opcion valor="publicadas" etiqueta="Publicadas" cantidad={conteo?.publicadas} />
              <Opcion valor="todas" etiqueta="Todas" cantidad={conteo?.todas} />
            </ToggleGroup>
          </div>

          {!datos ? (
            <TablaNovedadesEsqueleto />
          ) : datos.items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              No hay novedades publicadas: las que diste de baja están en “Todas”.
            </p>
          ) : (
            <TablaNovedades
              novedades={datos.items}
              onEditar={(novedad) => setEdicion({ modo: 'edicion', novedad })}
              onCambiar={cambiar}
            />
          )}

          {datos && datos.total > 0 && (
            <Paginacion
              pagina={datos.pagina}
              paginas={datos.paginas}
              total={datos.total}
              mostrando={datos.items.length}
              sustantivo="novedades"
              onCambiar={setPagina}
            />
          )}
        </Card>
      )}

      <NovedadDialog
        abierto={edicion.modo !== 'cerrado'}
        onOpenChange={(abierto) => !abierto && setEdicion({ modo: 'cerrado' })}
        novedad={edicion.modo === 'edicion' ? edicion.novedad : undefined}
        subtitulo={
          consorcio.cantidadUnidades
            ? `${consorcio.nombre} · ${consorcio.cantidadUnidades} unidades`
            : consorcio.nombre
        }
        onGuardar={guardar}
      />
    </div>
  );
}

/** Una opción del filtro segmentado, con su cantidad atenuada como en la grilla de cobranzas. */
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
