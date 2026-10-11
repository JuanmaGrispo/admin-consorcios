'use client';

import { Megaphone, Pin, Wrench } from 'lucide-react';
import Link from 'next/link';
import { ProximosEventos } from '@/components/inicio/proximos-eventos';
import { TarjetaExpensas } from '@/components/inicio/tarjeta-expensas';
import { IconoAmenity } from '@/components/reservas/icono-amenity';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useUnidadActiva } from '@/components/vecino/unidad-activa';
import { usePedido } from '@/hooks/use-pedido';
import { fechaDeInstante } from '@/lib/formato';
import { inicioService } from '@/services/inicio';
import type { AmenityDeInicio } from '@/types/inicio';

/** Cuántos eventos y novedades entran en el inicio; el resto, en "Ver todo". */
const EVENTOS = 3;
const NOVEDADES = 2;

/** "Buenas tardes" según la hora de Buenos Aires. */
function saludo(): string {
  const h = Number(
    new Date().toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', hour12: false }),
  );
  if (h >= 6 && h < 12) return 'Buenos días';
  if (h >= 12 && h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

function estadoAmenity(a: AmenityDeInicio): string {
  if (a.bloqueadoHoy) return 'No disponible hoy';
  if (a.libreHoy) return 'Libre hoy';
  return `${a.reservasHoy} ${a.reservasHoy === 1 ? 'reserva' : 'reservas'} hoy`;
}

/**
 * Pantalla 10 del prototipo: saldo de expensas, accesos rápidos, próximos
 * eventos y lo último del muro. Todo sale de un solo GET /inicio; la unidad
 * elegida arriba decide qué parte se muestra.
 */
export default function VecinoInicioPage() {
  const { unidad, consorcio } = useUnidadActiva();
  const { datos: inicio, error } = usePedido('inicio', () => inicioService.obtener(), 'No se pudo cargar el inicio.');

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  if (!inicio) return <EsqueletoInicio />;

  const mia = inicio.unidades.find((u) => u.id === unidad.id);
  const eventos = inicio.proximosEventos
    .filter((e) => (e.tipo === 'RESERVA' ? e.unidadId === unidad.id : e.consorcioId === consorcio.id))
    .slice(0, EVENTOS);
  const amenity = inicio.amenities.find((a) => a.consorcioId === consorcio.id);
  const novedades = inicio.novedades.filter((n) => n.consorcioId === consorcio.id).slice(0, NOVEDADES);
  const reclamos = mia?.reclamosAbiertos ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <header>
        <p className="text-sm text-muted-foreground">{saludo()},</p>
        <h1 className="text-2xl font-bold tracking-tight">
          {inicio.usuario.nombre} {inicio.usuario.apellido}
        </h1>
      </header>

      <TarjetaExpensas saldo={mia?.expensas ?? null} etiquetaUnidad={unidad.etiqueta} />

      <section className="grid grid-cols-2 gap-3" aria-label="Accesos rápidos">
        <Acceso
          href="/vecino/reclamos/nuevo"
          icono={<Wrench className="size-5" />}
          titulo="Nuevo reclamo"
          detalle={reclamos > 0 ? `${reclamos} en curso` : 'Sin reclamos abiertos'}
        />
        {amenity ? (
          <Acceso
            href="/vecino/reservas"
            icono={<IconoAmenity amenity={amenity} className="size-5" />}
            titulo={`Reservar ${amenity.nombre}`}
            detalle={estadoAmenity(amenity)}
          />
        ) : (
          <Acceso
            href="/vecino/novedades"
            icono={<Megaphone className="size-5" />}
            titulo="Novedades"
            detalle="El muro del edificio"
          />
        )}
      </section>

      <Seccion titulo="Próximos eventos" href="/vecino/asambleas" enlace="Ver todo">
        <ProximosEventos eventos={eventos} />
      </Seccion>

      <Seccion titulo="Novedades del edificio" href="/vecino/novedades" enlace="Ver muro">
        {novedades.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">Todavía no hay novedades en el muro.</p>
        ) : (
          <ul className="-mx-2 flex flex-col">
            {novedades.map((n) => (
              <li key={n.id}>
                <Button
                  asChild
                  variant="ghost"
                  className="h-auto w-full flex-col items-start gap-0.5 px-2 py-2 text-left font-normal whitespace-normal"
                >
                  <Link href="/vecino/novedades">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      {n.fijada && <Pin className="size-3 text-primary" />}
                      {n.fijada && 'Fijado · '}
                      {fechaDeInstante(n.publicadaAt ?? n.createdAt)}
                    </span>
                    <span className="text-sm font-semibold">{n.titulo}</span>
                    <span className="line-clamp-2 text-xs text-secondary-foreground">{n.cuerpo}</span>
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Seccion>
    </div>
  );
}

function Acceso({ href, icono, titulo, detalle }: { href: string; icono: React.ReactNode; titulo: string; detalle: string }) {
  return (
    <Button
      asChild
      variant="outline"
      className="h-auto flex-col items-start gap-2 bg-card p-3 text-left font-normal whitespace-normal"
    >
      <Link href={href}>
        <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">{icono}</span>
        <span>
          <span className="block text-sm font-semibold">{titulo}</span>
          <span className="block text-xs text-muted-foreground">{detalle}</span>
        </span>
      </Link>
    </Button>
  );
}

function Seccion({
  titulo,
  href,
  enlace,
  children,
}: {
  titulo: string;
  href: string;
  enlace: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-2">
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{titulo}</h2>
          <Button asChild variant="link" size="sm" className="h-auto px-0">
            <Link href={href}>{enlace}</Link>
          </Button>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function EsqueletoInicio() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-2 h-7 w-44" />
      </div>
      <Skeleton className="h-52 rounded-xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-36 rounded-xl" />
    </div>
  );
}
