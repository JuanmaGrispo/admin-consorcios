'use client';

import { CalendarDays, FolderOpen, Landmark, Plus, Vote } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { useConsorcioActivo } from '@/components/admin/consorcio-activo';
import { AsambleaDialog, type ValoresAsamblea } from '@/components/asambleas/asamblea-dialog';
import { anioDe, estaCerrada } from '@/components/asambleas/etiquetas';
import { KpisAsambleas } from '@/components/asambleas/kpis-asambleas';
import { LibroActas } from '@/components/asambleas/libro-actas';
import { TablaAsambleas, TablaAsambleasEsqueleto } from '@/components/asambleas/tabla-asambleas';
import { ConfirmarAccion } from '@/components/confirmar-accion';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { crearVotacion } from '@/components/votaciones/crear-votacion';
import { VotacionDialog, type ValoresVotacion } from '@/components/votaciones/votacion-dialog';
import { usePedido } from '@/hooks/use-pedido';
import { ApiError } from '@/lib/api';
import { asambleasService } from '@/services/asambleas';
import type { Asamblea } from '@/types/asamblea';
import type { Consorcio } from '@/types/consorcio';

type Filtro = 'TODAS' | 'PROXIMAS' | 'CERRADAS';

const FILTROS: { valor: Filtro; etiqueta: string }[] = [
  { valor: 'TODAS', etiqueta: 'Todas' },
  { valor: 'PROXIMAS', etiqueta: 'Próximas' },
  { valor: 'CERRADAS', etiqueta: 'Cerradas' },
];

/** El valor del selector de año para no filtrar. */
const TODOS_LOS_ANIOS = 'TODOS';

/** Qué tiene abierto la página: nada, un alta, el libro de actas o la baja de un borrador. */
type Abierto =
  | { que: 'nada' }
  | { que: 'asamblea' }
  | { que: 'votacion' }
  | { que: 'libro' }
  | { que: 'eliminar'; asamblea: Asamblea };

export default function AdminAsambleasPage() {
  const { consorcio } = useConsorcioActivo();
  // Otro edificio arranca de cero: sin filtro ni la lista anterior.
  return <AsambleasAdministradas key={consorcio.id} consorcio={consorcio} />;
}

/** Las asambleas del consorcio activo: crear una y entrar al detalle para llevarla adelante. */
function AsambleasAdministradas({ consorcio }: { consorcio: Consorcio }) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<Filtro>('TODAS');
  const [anioElegido, setAnioElegido] = useState(String(new Date().getFullYear()));
  const [abierto, setAbierto] = useState<Abierto>({ que: 'nada' });
  const cerrar = () => setAbierto({ que: 'nada' });

  // Se piden todas: los KPIs y el libro de actas miran más allá del año elegido.
  const pedido = usePedido(
    `asambleas:${consorcio.id}`,
    () => asambleasService.listar({ consorcioId: consorcio.id }),
    'No se pudieron cargar las asambleas.',
  );
  const asambleas = pedido.datos ?? null;
  const error = pedido.error ?? null;

  // Los años con asambleas, más el actual aunque todavía no tenga ninguna.
  const anios = [...new Set([new Date().getFullYear(), ...(asambleas ?? []).map((a) => anioDe(a.fechaHora))])].sort(
    (a, b) => b - a,
  );
  const anio = anioElegido === TODOS_LOS_ANIOS ? null : Number(anioElegido);
  const delAnio = (asambleas ?? []).filter((a) => anio === null || anioDe(a.fechaHora) === anio);

  const pasaFiltro = (a: Asamblea, f: Filtro) =>
    f === 'TODAS' ? true : f === 'CERRADAS' ? estaCerrada(a) : !estaCerrada(a);
  const visibles = delAnio.filter((a) => pasaFiltro(a, filtro));
  const cantidad = (f: Filtro) => delAnio.filter((a) => pasaFiltro(a, f)).length;

  async function crearAsamblea(valores: ValoresAsamblea, citar: boolean) {
    const { id } = await asambleasService.crear({ consorcioId: consorcio.id, ...valores });
    if (!citar) {
      toast.success('Asamblea guardada en borrador');
    } else {
      // Ya está creada: si la citación falla no se relanza, porque reintentar la duplicaría.
      try {
        await asambleasService.convocar(id);
        toast.success('Asamblea creada y citada: los vecinos ya pueden confirmar');
      } catch (err) {
        toast.error(`Quedó en borrador: ${err instanceof ApiError ? err.message : 'no se pudo citar.'}`);
      }
    }
    // Lo que sigue (completarla, llevar el quórum) se hace en el detalle.
    router.push(`/admin/asambleas/${id}`);
  }

  async function guardarVotacion(valores: ValoresVotacion, publicar: boolean) {
    await crearVotacion({ consorcioId: consorcio.id, ...valores }, publicar);
    cerrar();
    // Una votación de asamblea suma un punto a su orden del día, pero el listado no lo muestra.
  }

  async function bajarBorradorActa(asamblea: Asamblea) {
    try {
      await asambleasService.descargarActaBorrador(asamblea.id, asamblea.titulo);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo generar el borrador del acta.');
    }
  }

  const subtitulo = consorcio.cantidadUnidades
    ? `${consorcio.nombre} · ${consorcio.cantidadUnidades} unidades`
    : consorcio.nombre;

  const nueva = (
    <Button onClick={() => setAbierto({ que: 'asamblea' })}>
      <Plus data-icon="inline-start" />
      Nueva asamblea
    </Button>
  );

  const proximas = (asambleas ?? []).filter((a) => !estaCerrada(a)).length;
  const cerradasDelAnio = delAnio.filter(estaCerrada).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        titulo="Asambleas"
        contexto={[consorcio.nombre, consorcio.barrio].filter(Boolean).join(' · ')}
        descripcion={
          asambleas
            ? `${proximas} ${proximas === 1 ? 'próxima' : 'próximas'} · ${cerradasDelAnio} ${cerradasDelAnio === 1 ? 'asamblea cerrada' : 'asambleas cerradas'}${anio === null ? '' : ` en ${anio}`}`
            : 'Convocá, llevá el quórum y dejá el acta del edificio.'
        }
        acciones={
          <>
            <Button variant="outline" onClick={() => setAbierto({ que: 'libro' })} disabled={!asambleas}>
              <FolderOpen data-icon="inline-start" />
              Libro de actas
            </Button>
            <Button variant="outline" onClick={() => setAbierto({ que: 'votacion' })}>
              <Vote data-icon="inline-start" />
              Nueva votación
            </Button>
            {nueva}
          </>
        }
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
        <>
          <KpisAsambleas asambleas={asambleas} anio={anio} />

          <Card className="gap-0 py-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
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
              <Select value={anioElegido} onValueChange={setAnioElegido}>
                <SelectTrigger size="sm" className="w-40" aria-label="Año">
                  <CalendarDays />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {anios.map((a) => (
                    <SelectItem key={a} value={String(a)}>
                      {a}
                    </SelectItem>
                  ))}
                  <SelectItem value={TODOS_LOS_ANIOS}>Todos los años</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!asambleas ? (
              <TablaAsambleasEsqueleto />
            ) : visibles.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                No hay asambleas en este filtro{anio === null ? '' : ` para ${anio}`}.
              </p>
            ) : (
              <>
                <TablaAsambleas
                  asambleas={visibles}
                  onBorradorActa={bajarBorradorActa}
                  onEliminar={(asamblea) => setAbierto({ que: 'eliminar', asamblea })}
                />
                <p className="border-t px-4 py-3 text-xs text-muted-foreground">
                  {visibles.length} {visibles.length === 1 ? 'asamblea' : 'asambleas'} · las cerradas conservan el
                  acta firmada
                </p>
              </>
            )}
          </Card>
        </>
      )}

      {abierto.que === 'asamblea' && (
        <AsambleaDialog
          abierto
          onOpenChange={(sigue) => !sigue && cerrar()}
          subtitulo={subtitulo}
          unidades={consorcio.cantidadUnidades}
          onGuardar={crearAsamblea}
        />
      )}

      {abierto.que === 'votacion' && (
        <VotacionDialog
          abierto
          onOpenChange={(sigue) => !sigue && cerrar()}
          consorcioId={consorcio.id}
          subtitulo={subtitulo}
          onGuardar={guardarVotacion}
        />
      )}

      <LibroActas
        abierto={abierto.que === 'libro'}
        onOpenChange={(sigue) => !sigue && cerrar()}
        asambleas={asambleas ?? []}
      />

      <ConfirmarAccion
        abierto={abierto.que === 'eliminar'}
        titulo="¿Eliminar la asamblea?"
        descripcion={
          abierto.que === 'eliminar'
            ? `“${abierto.asamblea.titulo}” es un borrador: se borra con su orden del día y no se puede recuperar.`
            : ''
        }
        boton="Eliminar"
        destructiva
        onConfirmar={async () => {
          if (abierto.que !== 'eliminar') return;
          await asambleasService.eliminar(abierto.asamblea.id);
          toast.success('Asamblea eliminada');
          pedido.recargar();
        }}
        onCerrar={cerrar}
      />
    </div>
  );
}
