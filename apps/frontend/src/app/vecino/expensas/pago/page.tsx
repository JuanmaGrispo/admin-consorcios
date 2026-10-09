'use client';

import { CircleCheck, CircleX, Clock, CreditCard, Download, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { toast } from 'sonner';
import { MEDIOS } from '@/components/expensas/etiquetas';
import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePedido } from '@/hooks/use-pedido';
import { ApiError } from '@/lib/api';
import { fechaHora, pesos, periodo } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { expensasService } from '@/services/expensas';
import { pagosService } from '@/services/pagos';
import type { Pago } from '@/types/pago';

/**
 * Pagar expensas con Mercado Pago (pantalla 12). Es también la vuelta del
 * checkout, para expensas y para señas de reservas: Mercado Pago vuelve acá
 * con `external_reference`, que es nuestro id de pago.
 */
export default function VecinoPagoPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <SegunParametros />
    </Suspense>
  );
}

function SegunParametros() {
  const parametros = useSearchParams();
  const referencia = parametros.get('external_reference');
  const boletaId = parametros.get('boleta');

  if (referencia) return <Resultado pagoId={referencia} />;
  if (boletaId) return <Resumen boletaId={boletaId} />;
  return (
    <div className="flex flex-col gap-3">
      <PageHeader titulo="Pagar expensas" volverA="/vecino/expensas" />
      <Alert>
        <AlertDescription>
          Elegí qué pagar desde <Link href="/vecino/expensas" className="text-primary underline">Mis expensas</Link>.
        </AlertDescription>
      </Alert>
    </div>
  );
}

/** Antes de ir a Mercado Pago: qué se paga y cuánto. */
function Resumen({ boletaId }: { boletaId: string }) {
  const [yendo, setYendo] = useState(false);
  const pedido = usePedido(
    `pagar:${boletaId}`,
    async () => {
      const boleta = await expensasService.obtenerBoleta(boletaId);
      // La fila de la grilla trae lo pagado y el saldo.
      const { items } = await expensasService.listarBoletas({ unidadId: boleta.unidadId, limite: 1 });
      return { boleta, fila: items.find((f) => f.id === boletaId) };
    },
    'No se pudo cargar la boleta.',
  );

  async function pagar() {
    setYendo(true);
    try {
      const { initPoint } = await pagosService.checkoutMercadoPago({ boletaId });
      window.location.assign(initPoint);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo iniciar el pago.');
      setYendo(false);
    }
  }

  const datos = pedido.datos;

  return (
    <div className="flex flex-col gap-3">
      <PageHeader titulo="Pagar expensas" volverA="/vecino/expensas" />
      {pedido.error ? (
        <Alert variant="destructive">
          <AlertDescription>{pedido.error}</AlertDescription>
        </Alert>
      ) : !datos ? (
        <Skeleton className="h-72 w-full" />
      ) : !datos.fila ? (
        // No es la más reciente de la unidad: el backend no la cobraría.
        <Alert>
          <AlertDescription>
            Esta boleta ya está incluida en la más reciente de tu unidad.{' '}
            <Link href="/vecino/expensas" className="text-primary underline">
              Pagá esa
            </Link>
            .
          </AlertDescription>
        </Alert>
      ) : datos.fila.saldo <= 0 ? (
        <Alert>
          <AlertDescription>Esta boleta ya está pagada. ¡Gracias!</AlertDescription>
        </Alert>
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-col gap-3">
              <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Vas a pagar</p>
              <ul className="flex flex-col gap-2 text-sm">
                <Linea concepto={`Expensas ${periodo(datos.boleta.liquidacion.periodo).toLowerCase()}`} monto={datos.boleta.importeOrdinarias} />
                {datos.boleta.importeExtraordinarias > 0 && (
                  <Linea concepto="Extraordinarias" monto={datos.boleta.importeExtraordinarias} />
                )}
                {datos.boleta.fondoReserva > 0 && <Linea concepto="Fondo de reserva" monto={datos.boleta.fondoReserva} />}
                {datos.boleta.saldoAnterior > 0 && <Linea concepto="Saldo anterior" monto={datos.boleta.saldoAnterior} />}
                {datos.boleta.interesesMora > 0 && <Linea concepto="Intereses por mora" monto={datos.boleta.interesesMora} />}
                {datos.boleta.ajusteManual !== 0 && <Linea concepto="Ajuste" monto={datos.boleta.ajusteManual} />}
                {datos.fila.pagado > 0 && <Linea concepto="Ya pagaste" monto={-datos.fila.pagado} />}
              </ul>
              <div className="flex items-baseline justify-between border-t pt-3">
                <span className="font-semibold">Total</span>
                <span className="text-2xl font-bold tabular-nums">{pesos(datos.fila.saldo)}</span>
              </div>
            </CardContent>
          </Card>
          <Button size="lg" onClick={pagar} disabled={yendo}>
            <CreditCard data-icon="inline-start" />
            {yendo ? 'Abriendo Mercado Pago…' : `Pagar ${pesos(datos.fila.saldo)}`}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Procesado por Mercado Pago: tarjeta, dinero en cuenta o efectivo. El recibo queda en Mis expensas.
          </p>
        </>
      )}
    </div>
  );
}

/** A la vuelta del checkout: se le pregunta a Mercado Pago cómo quedó, sin esperar al webhook. */
function Resultado({ pagoId }: { pagoId: string }) {
  const pedido = usePedido(`sincronizar:${pagoId}`, () => pagosService.sincronizar(pagoId), 'No se pudo consultar el pago.');
  const pago = pedido.datos;
  const esReserva = pago?.concepto === 'SENA_RESERVA';
  const volver = esReserva ? '/vecino/reservas' : '/vecino/expensas';

  return (
    <div className="flex flex-col gap-3">
      <PageHeader titulo={esReserva ? 'Seña de la reserva' : 'Pagar expensas'} volverA={volver} />
      {pedido.error ? (
        <Alert variant="destructive">
          <AlertDescription>{pedido.error}</AlertDescription>
        </Alert>
      ) : !pago ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <Clock className="size-10 text-muted-foreground" />
            <p className="font-semibold">Confirmando el pago</p>
            <p className="text-sm text-muted-foreground">No cierres esta pantalla: estamos consultando con Mercado Pago.</p>
          </CardContent>
        </Card>
      ) : (
        <TarjetaResultado pago={pago} volver={volver} consultando={pedido.cargando} onConsultar={pedido.recargar} />
      )}
    </div>
  );
}

function TarjetaResultado({
  pago,
  volver,
  consultando,
  onConsultar,
}: {
  pago: Pago;
  volver: string;
  consultando: boolean;
  onConsultar: () => void;
}) {
  async function recibo() {
    try {
      await pagosService.descargarRecibo(pago.id, pago.reciboNumero);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo generar el recibo.');
    }
  }

  const aprobado = pago.estado === 'APROBADO';
  const pendiente = pago.estado === 'PENDIENTE';
  const Icono = aprobado ? CircleCheck : pendiente ? Clock : CircleX;

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-6 text-center">
        <Icono
          className={cn('size-12', aprobado ? 'text-success' : pendiente ? 'text-warning' : 'text-destructive')}
        />
        <div>
          <p className="text-lg font-semibold">
            {aprobado
              ? 'Pago aprobado'
              : pendiente
                ? 'Pago en proceso'
                : pago.estado === 'REINTEGRADO'
                  ? 'Pago devuelto'
                  : 'Pago rechazado'}
          </p>
          <p className="text-2xl font-bold tabular-nums">{pesos(pago.monto)}</p>
          {pago.fechaPago && <p className="text-sm text-muted-foreground tabular-nums">{fechaHora(pago.fechaPago)}</p>}
        </div>

        {aprobado && (
          <dl className="grid w-full gap-2 rounded-lg bg-muted p-3 text-left text-sm">
            {pago.unidad && <Dato nombre="Unidad" valor={pago.unidad.etiqueta} />}
            {pago.boleta?.liquidacion && <Dato nombre="Período" valor={periodo(pago.boleta.liquidacion.periodo)} />}
            <Dato nombre="Medio" valor={MEDIOS[pago.medio]} />
            {pago.reciboNumero && <Dato nombre="N° de recibo" valor={pago.reciboNumero} />}
          </dl>
        )}
        {pendiente && (
          <p className="text-sm text-muted-foreground">
            Mercado Pago todavía lo está procesando (pasa con efectivo o transferencia). Te avisamos cuando se acredite.
          </p>
        )}
        {!aprobado && !pendiente && (
          <p className="text-sm text-muted-foreground">
            No se hizo ningún cargo. Podés intentar de nuevo con otro medio.
            {pago.mpStatusDetail && <span className="mt-1 block text-xs">Código MP: {pago.mpStatusDetail}</span>}
          </p>
        )}

        <div className="flex w-full flex-col gap-2">
          {aprobado && (
            <Button onClick={recibo}>
              <Download data-icon="inline-start" />
              Descargar recibo
            </Button>
          )}
          {pendiente && (
            <Button variant="outline" onClick={onConsultar} disabled={consultando}>
              <RefreshCw data-icon="inline-start" />
              {consultando ? 'Consultando…' : 'Volver a consultar'}
            </Button>
          )}
          {!aprobado && !pendiente && pago.boletaId && (
            <Button asChild>
              <Link href={`/vecino/expensas/pago?boleta=${pago.boletaId}`}>Reintentar</Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href={volver}>{pago.concepto === 'SENA_RESERVA' ? 'Ver mis reservas' : 'Ver mis expensas'}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Linea({ concepto, monto }: { concepto: string; monto: number }) {
  return (
    <li className="flex items-baseline justify-between gap-3">
      <span className="text-secondary-foreground">{concepto}</span>
      <span className="tabular-nums">{pesos(monto)}</span>
    </li>
  );
}

function Dato({ nombre, valor }: { nombre: string; valor: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{nombre}</dt>
      <dd className="font-medium">{valor}</dd>
    </div>
  );
}
