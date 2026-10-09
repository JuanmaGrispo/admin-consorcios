'use client';

import { Ban, CalendarDays, Plus, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
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
import { ApiError } from '@/lib/api';
import { reservasService } from '@/services/reservas';
import type { Consorcio } from '@/types/consorcio';
import type { Amenity, Bloqueo, Reserva } from '@/types/reserva';

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
  const [amenities, setAmenities] = useState<Amenity[] | null>(null);
  const [elegidoId, setElegidoId] = useState<string | null>(null);
  const [lunes, setLunes] = useState(() => lunesDe(hoy()));
  const [semana, setSemana] = useState<{ reservas: Reserva[]; bloqueos: Bloqueo[]; clave: string } | null>(null);
  const [pendientes, setPendientes] = useState<Reserva[] | null>(null);
  const [estaSemana, setEstaSemana] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialogo, setDialogo] = useState<'amenity' | 'nuevo' | 'bloqueo' | null>(null);
  const [aRechazar, setARechazar] = useState<Reserva | null>(null);
  const [aQuitar, setAQuitar] = useState<Bloqueo | null>(null);
  // Sube después de cada cambio para volver a pedir lo que se ve.
  const [version, setVersion] = useState(0);
  const recargar = () => setVersion((v) => v + 1);

  const elegido = amenities?.find((a) => a.id === elegidoId) ?? amenities?.[0] ?? null;

  // Los amenities, incluidos los dados de baja: quien administra los puede reactivar.
  useEffect(() => {
    let vigente = true;
    reservasService
      .listarAmenities({ consorcioId: consorcio.id, incluirInactivos: true })
      .then((lista) => vigente && setAmenities(lista))
      .catch((err) => {
        if (vigente) setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los amenities.');
      });
    return () => {
      vigente = false;
    };
  }, [consorcio.id, version]);

  // Lo que espera aprobación y el número del encabezado: de todo el consorcio.
  useEffect(() => {
    let vigente = true;
    const lunesHoy = lunesDe(hoy());
    Promise.all([
      reservasService.listar({ consorcioId: consorcio.id, estado: 'PENDIENTE', situacion: 'proximas', limite: 50 }),
      reservasService.listar({ consorcioId: consorcio.id, desde: lunesHoy, hasta: sumarDias(lunesHoy, 6), limite: 100 }),
    ])
      .then(([pend, semanaActual]) => {
        if (!vigente) return;
        setPendientes([...pend.items].sort((a, b) => a.inicio.localeCompare(b.inicio)));
        setEstaSemana(semanaActual.items.filter((r) => VIGENTES.includes(r.estado)).length);
      })
      .catch(() => vigente && setPendientes([]));
    return () => {
      vigente = false;
    };
  }, [consorcio.id, version]);

  // La semana del amenity elegido: sus reservas y sus bloqueos.
  const amenityId = elegido?.id;
  useEffect(() => {
    if (!amenityId) return;
    let vigente = true;
    const domingo = sumarDias(lunes, 6);
    Promise.all([
      reservasService.listar({ amenityId, desde: lunes, hasta: domingo, limite: 100 }),
      reservasService.listarBloqueos(amenityId, { desde: lunes, hasta: sumarDias(lunes, 7) }),
    ])
      .then(([r, bloqueos]) => {
        if (vigente) setSemana({ reservas: r.items, bloqueos, clave: `${amenityId}:${lunes}` });
      })
      .catch((err) => {
        if (vigente) setError(err instanceof ApiError ? err.message : 'No se pudo cargar la semana.');
      });
    return () => {
      vigente = false;
    };
  }, [amenityId, lunes, version]);

  // Mientras llega la semana nueva, la vieja no se muestra como si fuera esta.
  const semanaVista = semana && semana.clave === `${amenityId}:${lunes}` ? semana : null;

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
