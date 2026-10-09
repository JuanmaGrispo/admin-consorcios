'use client';

import { CalendarDays } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmarAccion } from '@/components/confirmar-accion';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { MisReservas } from '@/components/reservas/mis-reservas';
import { Reservar, ReservarEsqueleto } from '@/components/reservas/reservar';
import { cuando } from '@/components/reservas/tiempo';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUnidadActiva } from '@/components/vecino/unidad-activa';
import { ApiError } from '@/lib/api';
import { pagosService } from '@/services/pagos';
import { reservasService } from '@/services/reservas';
import type { Consorcio } from '@/types/consorcio';
import type { Unidad } from '@/types/unidad';
import type { Amenity, Reserva } from '@/types/reserva';

const EN_PIE = ['PENDIENTE', 'APROBADA'];

export default function VecinoReservasPage() {
  const { unidad, consorcio } = useUnidadActiva();
  // Otra unidad puede ser de otro edificio: sus amenities y sus reservas.
  return <PantallaReservas key={unidad.id} unidad={unidad} consorcio={consorcio} />;
}

/** Pantalla 14: reservar un amenity y ver las reservas de la unidad. */
function PantallaReservas({ unidad, consorcio }: { unidad: Unidad; consorcio: Consorcio }) {
  const [solapa, setSolapa] = useState('reservar');
  const [amenities, setAmenities] = useState<Amenity[] | null>(null);
  const [reservas, setReservas] = useState<{ proximas: Reserva[]; anteriores: Reserva[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aCancelar, setACancelar] = useState<Reserva | null>(null);
  const [pagando, setPagando] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vigente = true;
    reservasService
      .listarAmenities({ consorcioId: consorcio.id })
      .then((lista) => vigente && setAmenities(lista.filter((a) => a.activo)))
      .catch((err) => {
        if (vigente) setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los amenities.');
      });
    return () => {
      vigente = false;
    };
  }, [consorcio.id]);

  useEffect(() => {
    let vigente = true;
    Promise.all([
      reservasService.listar({ unidadId: unidad.id, situacion: 'proximas', limite: 50 }),
      reservasService.listar({ unidadId: unidad.id, situacion: 'pasadas', limite: 20 }),
    ])
      .then(([prox, pas]) => {
        if (!vigente) return;
        // Por delante sólo lo que sigue en pie; lo cancelado o rechazado va con las anteriores.
        const porInicio = (a: Reserva, b: Reserva) => a.inicio.localeCompare(b.inicio);
        setReservas({
          proximas: prox.items.filter((r) => EN_PIE.includes(r.estado)).sort(porInicio),
          anteriores: [...prox.items.filter((r) => !EN_PIE.includes(r.estado)), ...pas.items].sort(
            (a, b) => -porInicio(a, b),
          ),
        });
      })
      .catch((err) => {
        if (vigente) setError(err instanceof ApiError ? err.message : 'No se pudieron cargar tus reservas.');
      });
    return () => {
      vigente = false;
    };
  }, [unidad.id, version]);

  async function pagarSena(r: Reserva) {
    setPagando(r.id);
    try {
      const { initPoint } = await pagosService.checkoutMercadoPago({ reservaId: r.id });
      window.location.assign(initPoint);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo abrir Mercado Pago.');
      setPagando(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader titulo="Reservar" volverA="/vecino" />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={solapa} onValueChange={setSolapa}>
        <TabsList className="w-full">
          <TabsTrigger value="reservar">Reservar</TabsTrigger>
          <TabsTrigger value="mis-reservas">Mis reservas</TabsTrigger>
        </TabsList>

        <TabsContent value="reservar" className="pt-2">
          {!amenities ? (
            !error && <ReservarEsqueleto />
          ) : amenities.length === 0 ? (
            <EmptyState
              icono={CalendarDays}
              titulo="No hay amenities para reservar"
              descripcion="Cuando la administración habilite el SUM, la parrilla u otro espacio, lo vas a poder reservar acá."
            />
          ) : (
            <Reservar
              amenities={amenities}
              unidadId={unidad.id}
              onReservada={(mensaje) => {
                toast.success(mensaje);
                setVersion((v) => v + 1);
                setSolapa('mis-reservas');
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="mis-reservas" className="pt-2">
          <MisReservas
            proximas={reservas?.proximas ?? null}
            anteriores={reservas?.anteriores ?? null}
            onPagarSena={pagarSena}
            onCancelar={setACancelar}
            pagando={pagando}
          />
        </TabsContent>
      </Tabs>

      <ConfirmarAccion
        abierto={aCancelar !== null}
        titulo={`¿Cancelar la reserva del ${aCancelar?.amenity.nombre ?? ''}?`}
        descripcion={aCancelar ? `${cuando(aCancelar.inicio, aCancelar.fin)}. El horario queda libre para otro vecino.` : ''}
        boton="Cancelar reserva"
        onConfirmar={async () => {
          if (!aCancelar) return;
          await reservasService.cancelar(aCancelar.id);
          toast.success('Reserva cancelada');
          setVersion((v) => v + 1);
        }}
        onCerrar={() => setACancelar(null)}
      />
    </div>
  );
}
