'use client';

import { CalendarDays, ChevronRight, Plus, TrendingDown, TrendingUp, Vote, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { GraficoCobranza } from '@/components/panel/grafico-cobranza';
import { RequiereAtencion } from '@/components/panel/requiere-atencion';
import { TablaConsorcios } from '@/components/panel/tabla-consorcios';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePedido } from '@/hooks/use-pedido';
import { periodo, pesos, porcentaje } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { panelService } from '@/services/panel';
import type { Panel } from '@/types/panel';

/** "julio" a partir de "2026-07". */
function mes(p: string): string {
  return periodo(p).split(' ')[0].toLowerCase();
}

interface Kpi {
  etiqueta: string;
  valor: string;
  /** La línea de abajo; con `tendencia`, lleva flecha y color. */
  detalle: string;
  tendencia?: 'buena' | 'mala' | 'neutra';
  sube?: boolean;
}

function kpisDe({ cobranza }: Panel): Kpi[] {
  const { anterior } = cobranza;
  const variacion =
    anterior && anterior.emitido > 0 ? ((cobranza.emitido - anterior.emitido) / anterior.emitido) * 100 : null;
  const puntos = anterior ? cobranza.morosidad - anterior.morosidad : null;
  const signo = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '');

  return [
    {
      etiqueta: 'Total liquidado',
      valor: pesos(cobranza.emitido, { redondo: true }),
      detalle:
        variacion === null || !anterior
          ? 'Sin período anterior para comparar'
          : `${signo(variacion)}${porcentaje(Math.abs(variacion))} vs ${mes(anterior.periodo)}`,
      tendencia: variacion === null ? undefined : 'neutra',
      sube: (variacion ?? 0) >= 0,
    },
    {
      etiqueta: 'Cobrado',
      valor: pesos(cobranza.cobrado, { redondo: true }),
      detalle: `${porcentaje(cobranza.porcentajeCobrado)} de lo emitido`,
    },
    {
      etiqueta: 'Pendiente',
      valor: pesos(cobranza.pendiente, { redondo: true }),
      detalle: `Vencido: ${cobranza.unidadesVencidas} ${cobranza.unidadesVencidas === 1 ? 'unidad' : 'unidades'}`,
    },
    {
      etiqueta: 'Morosidad',
      valor: porcentaje(cobranza.morosidad),
      detalle:
        puntos === null || !anterior
          ? 'Sin período anterior para comparar'
          : `${signo(puntos)}${Math.abs(puntos).toLocaleString('es-AR', { maximumFractionDigits: 1 })} pts vs ${mes(anterior.periodo)}`,
      // Que la morosidad baje es bueno.
      tendencia: puntos === null || puntos === 0 ? undefined : puntos < 0 ? 'buena' : 'mala',
      sube: (puntos ?? 0) > 0,
    },
  ];
}

const TONO_TENDENCIA = {
  buena: 'text-success',
  mala: 'text-destructive',
  neutra: 'text-muted-foreground',
};

/** Pantalla 01 del prototipo: todos los consorcios del administrador de un vistazo. */
export default function AdminPanelPage() {
  const { datos: panel, error } = usePedido('panel', () => panelService.obtener(), 'No se pudo cargar el panel.');

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader titulo="Panel general" />
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }
  if (!panel) return <EsqueletoPanel />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        contexto={`Período ${periodo(panel.periodo).toLowerCase()}`}
        titulo="Panel general"
        descripcion={`${panel.consorcios} ${panel.consorcios === 1 ? 'consorcio' : 'consorcios'} · ${panel.unidades} unidades`}
        acciones={
          <Button asChild>
            <Link href="/admin/liquidaciones">
              <Plus />
              Nueva liquidación
            </Link>
          </Button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Cobranza del período">
        {kpisDe(panel).map((kpi) => (
          <Card key={kpi.etiqueta}>
            <CardHeader>
              <CardDescription className="text-xs font-medium tracking-wide uppercase">{kpi.etiqueta}</CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums">{kpi.valor}</CardTitle>
              <p
                className={cn(
                  'flex items-center gap-1 text-xs',
                  kpi.tendencia ? TONO_TENDENCIA[kpi.tendencia] : 'text-muted-foreground',
                )}
              >
                {kpi.tendencia &&
                  (kpi.sube ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />)}
                {kpi.detalle}
              </p>
            </CardHeader>
          </Card>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Cobranza últimos 6 meses</CardTitle>
            <CardDescription>Emitido vs. cobrado, todos los consorcios</CardDescription>
          </CardHeader>
          <CardContent>
            <GraficoCobranza serie={panel.serie} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actividad de hoy</CardTitle>
          </CardHeader>
          <CardContent className="-mx-2 flex flex-col">
            <Actividad
              icono={Wrench}
              etiqueta="Reclamos abiertos"
              valor={panel.actividadHoy.reclamosAbiertos}
              href="/admin/reclamos"
            />
            <Actividad
              icono={CalendarDays}
              etiqueta="Reservas del día"
              valor={panel.actividadHoy.reservas}
              href="/admin/reservas"
              extra={
                panel.actividadHoy.reservasPendientes > 0 && (
                  <Badge variant="warning">{panel.actividadHoy.reservasPendientes} por aprobar</Badge>
                )
              }
            />
            <Actividad
              icono={Vote}
              etiqueta="Votaciones activas"
              valor={panel.actividadHoy.votacionesActivas}
              href="/admin/votaciones"
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden pb-0 lg:col-span-2">
          <CardHeader>
            <CardTitle>Mis consorcios</CardTitle>
            <CardDescription>Estado de cobranza del período en curso</CardDescription>
          </CardHeader>
          <TablaConsorcios consorcios={panel.porConsorcio} />
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              Requiere tu atención
              {panel.atencion.length > 0 && (
                <Badge variant="secondary">
                  {panel.atencion.length} {panel.atencion.length === 1 ? 'pendiente' : 'pendientes'}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RequiereAtencion items={panel.atencion} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface ActividadProps {
  icono: LucideIcon;
  etiqueta: string;
  valor: number;
  href: string;
  extra?: React.ReactNode;
}

function Actividad({ icono: Icono, etiqueta, valor, href, extra }: ActividadProps) {
  return (
    <Button asChild variant="ghost" className="h-auto justify-start gap-3 px-2 py-2.5 font-normal">
      <Link href={href}>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icono className="size-4" />
        </span>
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-sm text-secondary-foreground">
          {etiqueta}
          {extra}
        </span>
        <span className="text-lg font-semibold tabular-nums">{valor}</span>
        <ChevronRight className="size-4 text-muted-foreground" />
      </Link>
    </Button>
  );
}

function EsqueletoPanel() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Skeleton className="h-3 w-36" />
        <Skeleton className="mt-2 h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-56" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 rounded-xl lg:col-span-2" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}
