'use client';

import { CreditCard, Download, Receipt } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { EstadoBadge } from '@/components/estado-badge';
import { DetalleBoleta } from '@/components/expensas/detalle-boleta';
import { MEDIOS } from '@/components/expensas/etiquetas';
import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePedido } from '@/hooks/use-pedido';
import { ApiError } from '@/lib/api';
import { fecha, fechaDeInstante, pesos, periodo } from '@/lib/formato';
import { expensasService } from '@/services/expensas';
import { pagosService } from '@/services/pagos';

/** Una boleta del vecino: cuánto, por qué, qué pagó y, si corresponde, pagar el saldo. */
export default function VecinoBoletaPage() {
  const { id } = useParams<{ id: string }>();
  const [descargando, setDescargando] = useState(false);

  const pedido = usePedido(
    `boleta-vecino:${id}`,
    async () => {
      const boleta = await expensasService.obtenerBoleta(id);
      const [pagos, ultima] = await Promise.all([
        pagosService.listar({ boletaId: id }),
        // Sólo se paga la boleta más reciente de la unidad: las anteriores ya viajan en ella.
        expensasService.listarBoletas({ unidadId: boleta.unidadId, limite: 1 }),
      ]);
      return { boleta, pagos, ultima: ultima.items[0] };
    },
    'No se pudo cargar la boleta.',
  );

  if (pedido.error) {
    return (
      <div className="flex flex-col gap-3">
        <PageHeader titulo="Boleta" volverA="/vecino/expensas" />
        <Alert variant="destructive">
          <AlertDescription>{pedido.error}</AlertDescription>
        </Alert>
      </div>
    );
  }
  if (!pedido.datos) {
    return (
      <div className="flex flex-col gap-3">
        <PageHeader titulo="Boleta" volverA="/vecino/expensas" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const { boleta, pagos, ultima } = pedido.datos;
  const aprobados = pagos.filter((p) => p.estado === 'APROBADO');
  const pagado = aprobados.reduce((total, p) => total + p.monto, 0);
  const saldo = Math.max(0, Math.round((boleta.total - pagado) * 100) / 100);
  const esLaUltima = ultima?.id === boleta.id;
  const nombre = periodo(boleta.liquidacion.periodo);

  async function descargar() {
    setDescargando(true);
    try {
      await expensasService.descargarBoleta(boleta.id, `${boleta.unidad.etiqueta}-${boleta.liquidacion.periodo.slice(0, 7)}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo generar la boleta.');
    } finally {
      setDescargando(false);
    }
  }

  async function recibo(pagoId: string, numero: string | null) {
    try {
      await pagosService.descargarRecibo(pagoId, numero);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo generar el recibo.');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        titulo={`Expensas ${nombre.toLowerCase()}`}
        contexto={`Unidad ${boleta.unidad.etiqueta}`}
        volverA="/vecino/expensas"
      />

      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-3xl font-bold tabular-nums">{pesos(boleta.total)}</p>
              <p className="text-sm text-muted-foreground tabular-nums">
                Vence el {fecha(boleta.liquidacion.fechaVencimiento)}
              </p>
            </div>
            <EstadoBadge dominio="boleta" estado={boleta.estado}>
              {boleta.estado === 'PENDIENTE' ? 'Por vencer' : undefined}
            </EstadoBadge>
          </div>
          {pagado > 0 && saldo > 0 && (
            <p className="text-sm">
              Pagaste {pesos(pagado)}: te quedan <span className="font-semibold tabular-nums">{pesos(saldo)}</span>.
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            {saldo > 0 && esLaUltima && (
              <Button asChild>
                <Link href={`/vecino/expensas/pago?boleta=${boleta.id}`}>
                  <CreditCard data-icon="inline-start" />
                  Pagar {pesos(saldo)}
                </Link>
              </Button>
            )}
            <Button variant="outline" onClick={descargar} disabled={descargando}>
              <Download data-icon="inline-start" />
              {descargando ? 'Generando…' : 'Descargar boleta'}
            </Button>
          </div>
          {saldo > 0 && !esLaUltima && (
            <p className="rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
              Este saldo ya está incluido en tu boleta más reciente: pagá esa.
            </p>
          )}
        </CardContent>
      </Card>

      <DetalleBoleta boleta={boleta} />

      {aprobados.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pagos</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y">
              {aprobados.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div>
                    <p className="font-medium tabular-nums">{pesos(p.monto)}</p>
                    <p className="text-sm text-muted-foreground tabular-nums">
                      {MEDIOS[p.medio]}
                      {p.fechaPago && ` · ${fechaDeInstante(p.fechaPago)}`}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => recibo(p.id, p.reciboNumero)}>
                    <Receipt data-icon="inline-start" />
                    Recibo
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
