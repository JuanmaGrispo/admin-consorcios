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
import { Field, FieldLabel } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import { ApiError } from '@/lib/api';
import { novedadesService } from '@/services/novedades';
import type { Paginado } from '@/types/comun';
import type { Consorcio } from '@/types/consorcio';
import type { Novedad, NovedadCambios } from '@/types/novedad';

/** Qué tiene abierto el diálogo: nada, un alta o la edición de una novedad. */
type Edicion = { modo: 'cerrado' } | { modo: 'alta' } | { modo: 'edicion'; novedad: Novedad };

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
  const [incluirInactivas, setIncluirInactivas] = useState(false);
  const [datos, setDatos] = useState<Paginado<Novedad> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edicion, setEdicion] = useState<Edicion>({ modo: 'cerrado' });
  // Sube después de cada cambio para volver a pedir la página actual.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vigente = true;
    novedadesService
      .listar({ consorcioId: consorcio.id, incluirInactivas, pagina })
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
  }, [consorcio.id, incluirInactivas, pagina, version]);

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
        contexto={consorcio.nombre}
        descripcion="El muro del edificio: lo que publiques acá lo ven todos los vecinos."
        acciones={nueva}
      />

      <Field orientation="horizontal">
        <Switch
          id="inactivas"
          checked={incluirInactivas}
          onCheckedChange={(valor) => {
            setIncluirInactivas(valor);
            setPagina(1);
          }}
        />
        <FieldLabel htmlFor="inactivas">Mostrar las dadas de baja</FieldLabel>
      </Field>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : !datos ? (
        <TablaNovedadesEsqueleto />
      ) : datos.items.length === 0 ? (
        <EmptyState
          icono={Megaphone}
          titulo="Todavía no hay novedades"
          descripcion="Publicá un aviso para los vecinos: un corte de agua, un cambio de horario, el reglamento del SUM."
          accion={nueva}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <TablaNovedades
            novedades={datos.items}
            onEditar={(novedad) => setEdicion({ modo: 'edicion', novedad })}
            onCambiar={cambiar}
          />
          <Paginacion
            pagina={datos.pagina}
            paginas={datos.paginas}
            total={datos.total}
            onCambiar={setPagina}
          />
        </div>
      )}

      <NovedadDialog
        abierto={edicion.modo !== 'cerrado'}
        onOpenChange={(abierto) => !abierto && setEdicion({ modo: 'cerrado' })}
        novedad={edicion.modo === 'edicion' ? edicion.novedad : undefined}
        onGuardar={guardar}
      />
    </div>
  );
}
