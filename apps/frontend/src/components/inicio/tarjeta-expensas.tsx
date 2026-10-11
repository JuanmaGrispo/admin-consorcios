'use client';

import { CreditCard, Download, Receipt } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ApiError } from '@/lib/api';
import { fecha, fechaDeInstante, periodo, pesos } from '@/lib/formato';
import { expensasService } from '@/services/expensas';
import { pagosService } from '@/services/pagos';
import type { SaldoDeUnidad } from '@/types/inicio';

/** "Vence el 10/09/2026 · en 6 días", o cuánto hace que venció. */
function vencimiento(s: SaldoDeUnidad): string {
  const base = `Vence el ${fecha(s.fechaVencimiento)}`;
  if (s.diasParaVencer > 1) return `${base} · en ${s.diasParaVencer} días`;
  if (s.diasParaVencer === 1) return `${base} · mañana`;
  if (s.diasParaVencer === 0) return `${base} · hoy`;
  const dias = -s.diasParaVencer;
  return `Venció el ${fecha(s.fechaVencimiento)} · hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

interface TarjetaExpensasProps {
  saldo: SaldoDeUnidad | null;
  etiquetaUnidad: string;
}

/**
 * Lo primero del inicio (pantalla 10): cuánto debe de la boleta vigente y el
 * botón para pagarla, o, si está al día, el último pago con su recibo.
 */
export function TarjetaExpensas({ saldo, etiquetaUnidad }: TarjetaExpensasProps) {
  const [descargando, setDescargando] = useState(false);

  async function descargar(accion: () => Promise<void>) {
    setDescargando(true);
    try {
      await accion();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo descargar el archivo.');
    } finally {
      setDescargando(false);
    }
  }

  if (!saldo) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-1">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Expensas</p>
          <p className="text-sm text-muted-foreground">
            Todavía no hay expensas emitidas para tu unidad. Cuando la administración las emita, las vas a ver acá.
          </p>
        </CardContent>
      </Card>
    );
  }

  const alDia = saldo.saldo <= 0;
  const vencida = saldo.diasParaVencer < 0;
  const nombreArchivo = `${saldo.periodo}-${etiquetaUnidad.replace(/\s+/g, '')}`;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Expensas {periodo(saldo.periodo).toLowerCase()}
          </p>
          {alDia ? (
            <Badge variant="success">Al día</Badge>
          ) : vencida ? (
            <Badge variant="destructive">Vencida</Badge>
          ) : (
            <Badge variant="warning">{saldo.estado === 'PARCIAL' ? 'Pago parcial' : 'Por vencer'}</Badge>
          )}
        </div>

        <div>
          <p className="text-3xl font-bold tracking-tight tabular-nums">{pesos(alDia ? 0 : saldo.saldo)}</p>
          <p className={vencida && !alDia ? 'mt-1 text-sm text-destructive' : 'mt-1 text-sm text-muted-foreground'}>
            {alDia
              ? saldo.ultimoPago
                ? `Pagaste ${pesos(saldo.pagado)} el ${fechaDeInstante(saldo.ultimoPago.fecha)}`
                : 'No tenés saldo pendiente'
              : vencimiento(saldo)}
          </p>
        </div>

        {alDia ? (
          saldo.ultimoPago && (
            <Button
              variant="outline"
              size="lg"
              className="h-11 w-full"
              disabled={descargando}
              onClick={() => descargar(() => pagosService.descargarRecibo(saldo.ultimoPago!.id))}
            >
              <Receipt />
              Ver recibo
            </Button>
          )
        ) : (
          <>
            <Button asChild size="lg" className="h-12 w-full text-base">
              <Link href={`/vecino/expensas/pago?boleta=${saldo.boletaId}`}>
                <CreditCard />
                Pagar ahora
              </Link>
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button asChild variant="outline">
                <Link href={`/vecino/expensas/${saldo.boletaId}`}>Ver detalle</Link>
              </Button>
              <Button
                variant="outline"
                disabled={descargando}
                onClick={() => descargar(() => expensasService.descargarBoleta(saldo.boletaId, nombreArchivo))}
              >
                <Download />
                Descargar PDF
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
