'use client';

import { Download, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { EstadoBadge } from '@/components/estado-badge';
import { Paginacion } from '@/components/paginacion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usePedido } from '@/hooks/use-pedido';
import { ApiError } from '@/lib/api';
import { pesos, porcentaje } from '@/lib/formato';
import { expensasService } from '@/services/expensas';
import type { FilaCobranza, Liquidacion } from '@/types/expensa';
import { DialogoAjuste } from './dialogo-ajuste';

const ENCABEZADO =
  'bg-muted hover:bg-muted [&_th]:text-xs [&_th]:font-semibold [&_th]:tracking-wider [&_th]:text-muted-foreground [&_th]:uppercase';
const BORDES = '[&>*:first-child]:pl-4 [&>*:last-child]:pr-4';

interface BoletasLiquidacionProps {
  liquidacion: Liquidacion;
  /** Sube cada vez que la liquidación cambia (gasto, criterio, recálculo): las boletas se vuelven a pedir. */
  version: number;
}

/**
 * Las boletas de la liquidación (paso 3 de la pantalla 03): en previsualización
 * se pueden ajustar a mano; emitidas, se ven y se descargan.
 */
export function BoletasLiquidacion({ liquidacion, version }: BoletasLiquidacionProps) {
  const [pagina, setPagina] = useState(1);
  const [ajustando, setAjustando] = useState<FilaCobranza | null>(null);
  const previsualizada = liquidacion.estado === 'PREVISUALIZACION';

  const pedido = usePedido(
    `boletas-liquidacion:${liquidacion.id}:${version}:${pagina}`,
    () => expensasService.listarBoletas({ liquidacionId: liquidacion.id, pagina, limite: 20 }),
    'No se pudieron cargar las boletas.',
  );
  const datos = pedido.datos ?? pedido.ultimo;

  async function ajustar(fila: FilaCobranza, ajuste: number, motivo: string) {
    await expensasService.ajustarBoleta(fila.id, ajuste, motivo || undefined);
    toast.success(`Boleta de ${fila.unidad.etiqueta} ajustada`);
    setAjustando(null);
    pedido.recargar();
  }

  async function descargar(fila: FilaCobranza) {
    try {
      await expensasService.descargarBoleta(fila.id, `${fila.unidad.etiqueta}-${fila.periodo}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo generar la boleta.');
    }
  }

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b py-4">
        <CardTitle>{previsualizada ? 'Previsualización de boletas' : 'Boletas emitidas'}</CardTitle>
        <CardDescription>
          {previsualizada
            ? 'Así quedarían. Se recalculan si cambiás un gasto o el criterio; los ajustes manuales se conservan.'
            : 'Ya les llegaron a los vecinos. El cobro se sigue en Cobranzas.'}
        </CardDescription>
      </CardHeader>

      {pedido.error ? (
        <div className="p-4">
          <Alert variant="destructive">
            <AlertDescription>{pedido.error}</AlertDescription>
          </Alert>
        </div>
      ) : !datos ? (
        <div className="flex flex-col gap-3 p-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow className={`${ENCABEZADO} ${BORDES}`}>
                <TableHead>Unidad</TableHead>
                <TableHead className="hidden sm:table-cell">Propietario</TableHead>
                <TableHead className="hidden text-right md:table-cell">Coef.</TableHead>
                <TableHead className="text-right">Total</TableHead>
                {!previsualizada && <TableHead className="hidden sm:table-cell">Estado</TableHead>}
                <TableHead>
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {datos.items.map((f) => (
                <TableRow key={f.id} className={BORDES}>
                  <TableCell className="font-medium">{f.unidad.etiqueta}</TableCell>
                  <TableCell className="hidden text-secondary-foreground sm:table-cell">
                    {f.propietario ? `${f.propietario.nombre} ${f.propietario.apellido}` : '—'}
                  </TableCell>
                  <TableCell className="hidden text-right text-secondary-foreground tabular-nums md:table-cell">
                    {porcentaje(f.coeficienteAplicado, 4)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{pesos(f.emitido)}</TableCell>
                  {!previsualizada && (
                    <TableCell className="hidden sm:table-cell">
                      <EstadoBadge dominio="boleta" estado={f.estado} />
                    </TableCell>
                  )}
                  <TableCell className="text-right whitespace-nowrap">
                    {previsualizada && (
                      <Accion etiqueta="Ajustar a mano" onClick={() => setAjustando(f)}>
                        <SlidersHorizontal />
                      </Accion>
                    )}
                    <Accion etiqueta="Descargar PDF" onClick={() => void descargar(f)}>
                      <Download />
                    </Accion>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Paginacion
            pagina={datos.pagina}
            paginas={datos.paginas}
            total={datos.total}
            mostrando={datos.items.length}
            sustantivo="boletas"
            onCambiar={setPagina}
          />
        </>
      )}

      {ajustando && (
        <DialogoAjuste
          fila={ajustando}
          onGuardar={(ajuste, motivo) => ajustar(ajustando, ajuste, motivo)}
          onCerrar={() => setAjustando(null)}
        />
      )}
    </Card>
  );
}

function Accion({ etiqueta, onClick, children }: { etiqueta: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={etiqueta}
          onClick={onClick}
          className="text-muted-foreground hover:text-primary"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{etiqueta}</TooltipContent>
    </Tooltip>
  );
}
