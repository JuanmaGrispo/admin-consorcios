'use client';

import { CreditCard, Download, Receipt } from 'lucide-react';
import Link from 'next/link';
import { Fragment, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { FilaBoletaVecino, FilaBoletaVecinoEsqueleto } from '@/components/expensas/fila-boleta-vecino';
import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useUnidadActiva } from '@/components/vecino/unidad-activa';
import { usePedido } from '@/hooks/use-pedido';
import { ApiError } from '@/lib/api';
import { fecha, pesos } from '@/lib/formato';
import { expensasService } from '@/services/expensas';
import type { FilaCobranza } from '@/types/expensa';

const POR_PAGINA = 12;
/** El backend no devuelve más de 100 por pedido. */
const LIMITE_MAXIMO = 100;

export default function VecinoExpensasPage() {
  const { unidad } = useUnidadActiva();
  // Otra unidad es otra historia de boletas: arranca de cero.
  return <MisExpensas key={unidad.id} unidadId={unidad.id} etiqueta={unidad.etiqueta} />;
}

/** "Mis expensas" (pantalla 11): el saldo de hoy y la historia de períodos de la unidad. */
function MisExpensas({ unidadId, etiqueta }: { unidadId: string; etiqueta: string }) {
  const [limite, setLimite] = useState(POR_PAGINA);
  const [descargando, setDescargando] = useState(false);
  const pedido = usePedido(
    `mis-expensas:${unidadId}:${limite}`,
    () => expensasService.listarBoletas({ unidadId, limite }),
    'No se pudieron cargar tus expensas.',
  );
  // "Ver anteriores" pide una página más larga: mientras llega, sigue la lista de antes.
  const datos = pedido.datos ?? (limite > POR_PAGINA ? pedido.ultimo : undefined);
  // La más reciente es la única que se paga: las anteriores ya viajan en ella como saldo anterior.
  const ultima = datos?.items[0];
  const debe = ultima && ultima.saldo > 0;
  // De lo cargado: los períodos que todavía tienen saldo, aunque ya viajen en la última.
  const pendientes = datos?.items.filter((f) => f.saldo > 0).length ?? 0;

  /** El estado de cuenta de la unidad: la misma exportación de cobranzas, recortada a ella. */
  async function descargarEstadoDeCuenta() {
    setDescargando(true);
    try {
      await expensasService.exportar({ unidadId });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo descargar el estado de cuenta.');
    } finally {
      setDescargando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        titulo="Mis expensas"
        volverA="/vecino"
        acciones={
          datos &&
          datos.items.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={descargarEstadoDeCuenta}
                  disabled={descargando}
                  aria-label="Descargar estado de cuenta"
                >
                  <Download />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Descargar estado de cuenta</TooltipContent>
            </Tooltip>
          )
        }
      />

      {pedido.error && (
        <Alert variant="destructive">
          <AlertDescription>{pedido.error}</AlertDescription>
        </Alert>
      )}

      {!datos ? (
        !pedido.error && (
          <>
            <Skeleton className="h-36 w-full" />
            <Card className="py-0">
              <FilaBoletaVecinoEsqueleto />
              <FilaBoletaVecinoEsqueleto />
              <FilaBoletaVecinoEsqueleto />
            </Card>
          </>
        )
      ) : datos.items.length === 0 ? (
        <EmptyState
          icono={Receipt}
          titulo="Todavía no tenés expensas"
          descripcion="Cuando la administración emita la primera liquidación, vas a ver acá tu boleta y la vas a poder pagar."
        />
      ) : (
        <>
          <Card className={debe ? 'ring-primary' : undefined}>
            <CardContent className="flex flex-col gap-3">
              <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                Saldo actual de la unidad {etiqueta}
              </p>
              <p className="text-3xl font-bold tabular-nums">{pesos(debe ? ultima.saldo : 0)}</p>
              <p className="text-sm text-muted-foreground">
                {debe
                  ? `${pendientes} ${pendientes === 1 ? 'período pendiente' : 'períodos pendientes'} · ${
                      ultima.estado === 'VENCIDA' ? 'venció' : 'vence'
                    } el ${fecha(ultima.fechaVencimiento)}`
                  : 'Estás al día.'}
              </p>
              {debe && (
                <Button asChild className="w-full sm:w-auto sm:self-start">
                  <Link href={`/vecino/expensas/pago?boleta=${ultima.id}`}>
                    <CreditCard data-icon="inline-start" />
                    Pagar {pesos(ultima.saldo)}
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>

          {porAnio(datos.items).map(([anio, filas]) => (
            <Fragment key={anio}>
              <h2 className="mt-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                {anio} · {filas.length} {filas.length === 1 ? 'período' : 'períodos'}
              </h2>
              <Card className="gap-0 divide-y py-0">
                {filas.map((f) => (
                  <FilaBoletaVecino key={f.id} fila={f} />
                ))}
              </Card>
            </Fragment>
          ))}

          {datos.items.length < datos.total && limite < LIMITE_MAXIMO && (
            <Button
              variant="outline"
              className="self-center"
              disabled={pedido.cargando}
              onClick={() => setLimite((l) => Math.min(l + POR_PAGINA, LIMITE_MAXIMO))}
            >
              {pedido.cargando ? 'Cargando…' : 'Ver anteriores'}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Los períodos agrupados por año, del más nuevo al más viejo (ya vienen así).
 * La cantidad es la de lo cargado: con "Ver anteriores" el año viejo crece.
 */
function porAnio(filas: FilaCobranza[]): [string, FilaCobranza[]][] {
  const grupos = new Map<string, FilaCobranza[]>();
  for (const f of filas) {
    const anio = f.periodo.slice(0, 4);
    grupos.set(anio, [...(grupos.get(anio) ?? []), f]);
  }
  return [...grupos.entries()];
}
