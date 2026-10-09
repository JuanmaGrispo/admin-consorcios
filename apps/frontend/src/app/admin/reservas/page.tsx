'use client';

import { Ban, CalendarDays, Plus, Settings } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useConsorcioActivo } from '@/components/admin/consorcio-activo';
import { ConfirmarAccion } from '@/components/confirmar-accion';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { CalendarioSemanal } from '@/components/reservas/calendario-semanal';
import { DialogoAmenity, type ValoresAmenity } from '@/components/reservas/dialogo-amenity';
import { DialogoBloqueo } from '@/components/reservas/dialogo-bloqueo';
import { DialogoRechazo } from '@/components/reservas/dialogo-rechazo';
import { ListaAmenities, PendientesAprobacion, ReglasAmenity } from '@/components/reservas/panel-amenity';
import { fechaCorta, fechaDe, hoy, lunesDe, sumarDias } from '@/components/reservas/tiempo';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePedido } from '@/hooks/use-pedido';
import { ApiError } from '@/lib/api';
import { reservasService } from '@/services/reservas';
import type { Consorcio } from '@/types/consorcio';
import type { Bloqueo, Reserva } from '@/types/reserva';

const VIGENTES = ['PENDIENTE', 'APROBADA', 'FINALIZADA'];

/** "1 amenity habilitado", "3 reservas esta semana". */
const cantidad = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`;

export default function AdminReservasPage() {
  const { consorcio } = useConsorcioActivo();
  // Otro edificio arranca de cero: sus amenities, su semana, sus pendientes.
  return <Reservas key={consorcio.id} consorcio={consorcio} />;
}

/** Pantalla 05: los amenities del consorcio, su semana y lo que espera aprobación. */
function Reservas({ consorcio }: { consorcio: Consorcio }) {
  const [elegidoId, setElegidoId] = useState<string | null>(null);
  const [lunes, setLunes] = useState(() => lunesDe(hoy()));
  const [dialogo, setDialogo] = useState<'amenity' | 'nuevo' | 'bloqueo' | null>(null);
  const [aRechazar, setARechazar] = useState<Reserva | null>(null);
  const [aQuitar, setAQuitar] = useState<Bloqueo | null>(null);

  // Los amenities, incluidos los dados de baja: quien administra los puede reactivar.
  const amenitiesPedido = usePedido(
    'amenities',
    () => reservasService.listarAmenities({ consorcioId: consorcio.id, incluirInactivos: true }),
    'No se pudieron cargar los amenities.',
  );
  const amenities = amenitiesPedido.datos ?? null;
  const elegido = amenities?.find((a) => a.id === elegidoId) ?? amenities?.[0] ?? null;

  // Lo que espera aprobación y el número del encabezado: de todo el consorcio.
  // Si falla, el panel queda vacío y el resto de la pantalla anda igual.
  const resumenPedido = usePedido('resumen', async () => {
    const lunesHoy = lunesDe(hoy());
    const [pend, semanaActual] = await Promise.all([
      reservasService.listar({ consorcioId: consorcio.id, estado: 'PENDIENTE', situacion: 'proximas', limite: 50 }),
      reservasService.listar({ consorcioId: consorcio.id, desde: lunesHoy, hasta: sumarDias(lunesHoy, 6), limite: 100 }),
    ]);
    return {
      pendientes: [...pend.items].sort((a, b) => a.inicio.localeCompare(b.inicio)),
      estaSemana: semanaActual.items.filter((r) => VIGENTES.includes(r.estado)).length,
    };
  });
  const pendientes = resumenPedido.datos?.pendientes ?? (resumenPedido.error ? [] : null);
  const estaSemana = resumenPedido.datos?.estaSemana ?? null;

  // La semana del amenity elegido: sus reservas y sus bloqueos. Con otra semana
  // u otro amenity, la clave cambia y no se muestra la anterior como si fuera esta.
  const semanaPedido = usePedido(
    elegido ? `semana:${elegido.id}:${lunes}` : null,
    async () => {
      const [r, bloqueos] = await Promise.all([
        reservasService.listar({ amenityId: elegido!.id, desde: lunes, hasta: sumarDias(lunes, 6), limite: 100 }),
        reservasService.listarBloqueos(elegido!.id, { desde: lunes, hasta: sumarDias(lunes, 7) }),
      ]);
      return { reservas: r.items, bloqueos };
    },
    'No se pudo cargar la semana.',
  );
  const semanaVista = semanaPedido.datos ?? null;
  const error = amenitiesPedido.error ?? semanaPedido.error;

  /** Después de un cambio: todo lo que se ve, sin vaciar la pantalla. */
  function recargar() {
    amenitiesPedido.recargar();
    resumenPedido.recargar();
    semanaPedido.recargar();
  }

  async function guardarAmenity(valores: ValoresAmenity) {
    if (dialogo === 'amenity' && elegido) {
      await reservasService.actualizarAmenity(elegido.id, valores);
      toast.success(`${valores.nombre} actualizado`);
    } else {
      const creado = await reservasService.crearAmenity({ consorcioId: consorcio.id, ...valores });
      setElegidoId(creado.id);
      toast.success(`${creado.nombre} creado`);
    }
    setDialogo(null);
    recargar();
  }

  async function aprobar(r: Reserva) {
    try {
      await reservasService.aprobar(r.id);
      toast.success(`Reserva de ${r.unidad.etiqueta} aprobada`);
      recargar();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo aprobar la reserva.');
    }
  }

  async function rechazar(r: Reserva, motivo: string) {
    await reservasService.rechazar(r.id, motivo);
    toast.success(`Reserva de ${r.unidad.etiqueta} rechazada`);
    setARechazar(null);
    recargar();
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader titulo="Amenities y reservas" contexto={contexto(consorcio)} />
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const habilitados = amenities?.filter((a) => a.activo).length ?? 0;
  const descripcion =
    amenities && pendientes && estaSemana !== null
      ? [
          cantidad(habilitados, 'amenity habilitado', 'amenities habilitados'),
          cantidad(estaSemana, 'reserva esta semana', 'reservas esta semana'),
          `${pendientes.length} esperando aprobación`,
        ].join(' · ')
      : undefined;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        titulo="Amenities y reservas"
        contexto={contexto(consorcio)}
        descripcion={descripcion}
        acciones={
          elegido && (
            <>
              <Button variant="outline" onClick={() => setDialogo('bloqueo')}>
                <Ban data-icon="inline-start" />
                Bloquear fechas
              </Button>
              <Button onClick={() => setDialogo('amenity')}>
                <Settings data-icon="inline-start" />
                Configurar amenity
              </Button>
            </>
          )
        }
      />

      {!amenities ? (
        <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      ) : !elegido ? (
        <EmptyState
          icono={CalendarDays}
          titulo="Todavía no hay amenities"
          descripcion="Cargá el SUM, la parrilla o la cochera de visitas para que los vecinos puedan reservarlos."
          accion={
            <Button onClick={() => setDialogo('nuevo')}>
              <Plus data-icon="inline-start" />
              Nuevo amenity
            </Button>
          }
        />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <ListaAmenities
              amenities={amenities}
              elegido={elegido.id}
              onElegir={setElegidoId}
              onNuevo={() => setDialogo('nuevo')}
            />
            <ReglasAmenity amenity={elegido} />
            <PendientesAprobacion reservas={pendientes} onAprobar={aprobar} onRechazar={setARechazar} />
          </div>
          <CalendarioSemanal
            amenity={elegido}
            lunes={lunes}
            reservas={semanaVista?.reservas ?? null}
            bloqueos={semanaVista?.bloqueos ?? null}
            onCambiarSemana={setLunes}
            onBloqueo={setAQuitar}
          />
        </div>
      )}

      <DialogoAmenity
        abierto={dialogo === 'amenity' || dialogo === 'nuevo'}
        onOpenChange={(abierto) => !abierto && setDialogo(null)}
        amenity={dialogo === 'amenity' ? (elegido ?? undefined) : undefined}
        subtitulo={consorcio.nombre}
        onGuardar={guardarAmenity}
      />
      {elegido && (
        <DialogoBloqueo
          abierto={dialogo === 'bloqueo'}
          onOpenChange={(abierto) => !abierto && setDialogo(null)}
          subtitulo={`${elegido.nombre} · ${consorcio.nombre}`}
          onBloquear={async (input) => {
            await reservasService.crearBloqueo(elegido.id, input);
            toast.success(`${elegido.nombre} bloqueado`);
            setDialogo(null);
            recargar();
          }}
        />
      )}
      <DialogoRechazo reserva={aRechazar} onCerrar={() => setARechazar(null)} onRechazar={rechazar} />
      <ConfirmarAccion
        abierto={aQuitar !== null}
        titulo="¿Quitar el bloqueo?"
        descripcion={
          aQuitar
            ? `${aQuitar.motivo || 'Bloqueo'} del ${fechaCorta(fechaDe(aQuitar.desde))}. Esas fechas vuelven a quedar disponibles para reservar.`
            : ''
        }
        boton="Quitar bloqueo"
        onConfirmar={async () => {
          if (!aQuitar || !elegido) return;
          await reservasService.borrarBloqueo(elegido.id, aQuitar.id);
          toast.success('Bloqueo quitado');
          recargar();
        }}
        onCerrar={() => setAQuitar(null)}
      />
    </div>
  );
}

/** "Av. Rivadavia 4820 · Almagro", como el resto de las pantallas del admin. */
const contexto = (c: Consorcio) => [c.nombre, c.barrio].filter(Boolean).join(' · ');
