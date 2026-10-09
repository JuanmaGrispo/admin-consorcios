'use client';

import { BellRing, Download, MoreHorizontal, Receipt, Wallet } from 'lucide-react';
import { EstadoBadge } from '@/components/estado-badge';
import { MEDIOS } from '@/components/expensas/etiquetas';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { fechaDeInstante, pesos, porcentaje } from '@/lib/formato';
import type { FilaCobranza } from '@/types/expensa';

const ENCABEZADO =
  'bg-muted hover:bg-muted [&_th]:text-xs [&_th]:font-semibold [&_th]:tracking-wider [&_th]:text-muted-foreground [&_th]:uppercase';
const BORDES = '[&>*:first-child]:pl-4 [&>*:last-child]:pr-4';

interface TablaCobranzasProps {
  filas: FilaCobranza[];
  onRegistrarPago: (fila: FilaCobranza) => void;
  onRecordatorio: (fila: FilaCobranza) => void;
  onBoleta: (fila: FilaCobranza) => void;
  onRecibo: (fila: FilaCobranza) => void;
}

/** La grilla de cobranzas (pantalla 02): una fila por boleta, con lo pagado y quién vive ahí. */
export function TablaCobranzas({ filas, onRegistrarPago, onRecordatorio, onBoleta, onRecibo }: TablaCobranzasProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className={`${ENCABEZADO} ${BORDES}`}>
          <TableHead>Unidad</TableHead>
          <TableHead className="hidden md:table-cell">Propietario</TableHead>
          <TableHead className="hidden text-right xl:table-cell">Coef.</TableHead>
          <TableHead className="hidden text-right lg:table-cell">Emitido</TableHead>
          <TableHead className="hidden text-right lg:table-cell">Pagado</TableHead>
          <TableHead className="text-right">Saldo</TableHead>
          <TableHead className="hidden xl:table-cell">Medio</TableHead>
          <TableHead className="hidden sm:table-cell">Estado</TableHead>
          <TableHead>
            <span className="sr-only">Acciones</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filas.map((f) => (
          <TableRow key={f.id} className={BORDES}>
            <TableCell>
              <p className="font-medium">{f.unidad.etiqueta}</p>
              {f.inquilino && (
                <p className="text-xs text-muted-foreground">
                  Inquilino: {f.inquilino.nombre} {f.inquilino.apellido}
                </p>
              )}
            </TableCell>
            <TableCell className="hidden md:table-cell">
              {f.propietario ? (
                <div className="max-w-48">
                  <p className="truncate">
                    {f.propietario.nombre} {f.propietario.apellido}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{f.propietario.telefono ?? f.propietario.email}</p>
                </div>
              ) : (
                <span className="text-muted-foreground">Sin propietario</span>
              )}
            </TableCell>
            <TableCell className="hidden text-right text-secondary-foreground tabular-nums xl:table-cell">
              {porcentaje(f.coeficienteAplicado, 2)}
            </TableCell>
            <TableCell className="hidden text-right tabular-nums lg:table-cell">{pesos(f.emitido)}</TableCell>
            <TableCell className="hidden text-right text-secondary-foreground tabular-nums lg:table-cell">
              {pesos(f.pagado)}
            </TableCell>
            <TableCell className={`text-right font-medium tabular-nums ${f.saldo > 0 ? '' : 'text-muted-foreground'}`}>
              {pesos(f.saldo)}
            </TableCell>
            <TableCell className="hidden text-secondary-foreground xl:table-cell">
              {f.medio ? (
                <>
                  {MEDIOS[f.medio]}
                  {f.ultimoPago && (
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {fechaDeInstante(f.ultimoPago.fecha)}
                    </span>
                  )}
                </>
              ) : (
                '—'
              )}
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              <EstadoBadge dominio="boleta" estado={f.estado} />
            </TableCell>
            <TableCell className="text-right whitespace-nowrap">
              {f.saldo > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Registrar pago"
                      onClick={() => onRegistrarPago(f)}
                      className="hidden text-muted-foreground hover:text-primary sm:inline-flex"
                    >
                      <Wallet />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Registrar pago</TooltipContent>
                </Tooltip>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Más acciones"
                    className="text-muted-foreground hover:text-primary"
                  >
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {f.saldo > 0 && (
                    <DropdownMenuItem className="sm:hidden" onSelect={() => onRegistrarPago(f)}>
                      <Wallet />
                      Registrar pago
                    </DropdownMenuItem>
                  )}
                  {f.saldo > 0 && (
                    <DropdownMenuItem onSelect={() => onRecordatorio(f)}>
                      <BellRing />
                      Enviar recordatorio
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={() => onBoleta(f)}>
                    <Download />
                    Boleta en PDF
                  </DropdownMenuItem>
                  {f.ultimoPago && (
                    <DropdownMenuItem onSelect={() => onRecibo(f)}>
                      <Receipt />
                      Recibo del último pago
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Las filas mientras carga: misma forma, sin datos. */
export function TablaCobranzasEsqueleto() {
  return (
    <div>
      <div className="h-9 border-b bg-muted" />
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0">
          <Skeleton className="h-4 w-14" />
          <Skeleton className="hidden h-4 w-32 md:block" />
          <Skeleton className="ml-auto h-4 w-20" />
          <Skeleton className="hidden h-5 w-16 rounded-full sm:block" />
        </div>
      ))}
    </div>
  );
}
