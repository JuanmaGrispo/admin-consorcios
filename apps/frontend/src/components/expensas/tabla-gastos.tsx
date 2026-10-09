'use client';

import { FileText, Pencil, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { pesos } from '@/lib/formato';
import { NATURALEZAS_GASTO } from '@/types/catalogo';
import type { Gasto } from '@/types/expensa';

const ENCABEZADO =
  'bg-muted hover:bg-muted [&_th]:text-xs [&_th]:font-semibold [&_th]:tracking-wider [&_th]:text-muted-foreground [&_th]:uppercase';
const BORDES = '[&>*:first-child]:pl-4 [&>*:last-child]:pr-4';

interface TablaGastosProps {
  gastos: Gasto[];
  total: number;
  /** Emitida, la lista queda de sólo lectura. */
  editable: boolean;
  onAgregar: () => void;
  onEditar: (gasto: Gasto) => void;
  onBorrar: (gasto: Gasto) => void;
}

/** Los gastos del período (paso 1 de la pantalla 03), con el total al pie. */
export function TablaGastos({ gastos, total, editable, onAgregar, onEditar, onBorrar }: TablaGastosProps) {
  const sinComprobante = gastos.filter((g) => !g.comprobanteUrl && !g.comprobanteNumero).length;

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b py-4">
        <CardTitle>Gastos del período</CardTitle>
        <CardDescription>
          {gastos.length} {gastos.length === 1 ? 'gasto cargado' : 'gastos cargados'}
          {sinComprobante > 0 && ` · ${sinComprobante} sin comprobante`}
        </CardDescription>
        {editable && (
          <CardAction>
            <Button size="sm" onClick={onAgregar}>
              <Plus data-icon="inline-start" />
              Agregar gasto
            </Button>
          </CardAction>
        )}
      </CardHeader>

      {gastos.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          Todavía no hay gastos. Cargá sueldos, servicios y facturas del mes para poder calcular las boletas.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className={`${ENCABEZADO} ${BORDES}`}>
              <TableHead>Rubro</TableHead>
              <TableHead className="hidden md:table-cell">Proveedor</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="hidden sm:table-cell">Comprobante</TableHead>
              {editable && (
                <TableHead>
                  <span className="sr-only">Acciones</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {gastos.map((g) => (
              <TableRow key={g.id} className={BORDES}>
                <TableCell className="whitespace-normal">
                  <div className="max-w-48 sm:max-w-xs">
                    <p className="truncate font-medium">{g.descripcion}</p>
                    <p className="text-xs text-muted-foreground">
                      {g.rubro.nombre}
                      {g.naturaleza !== 'ORDINARIO' &&
                        ` · ${NATURALEZAS_GASTO.find((n) => n.valor === g.naturaleza)?.etiqueta}`}
                      {g.cuotaNumero && g.cuotaTotal && ` · cuota ${g.cuotaNumero}/${g.cuotaTotal}`}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="hidden text-secondary-foreground md:table-cell">
                  {g.proveedor?.razonSocial ?? '—'}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">{pesos(g.monto)}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  {g.comprobanteUrl ? (
                    <a
                      href={g.comprobanteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <FileText className="size-3.5" />
                      {g.comprobanteNumero || 'Ver'}
                    </a>
                  ) : g.comprobanteNumero ? (
                    <span className="text-sm text-secondary-foreground">{g.comprobanteNumero}</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-sm text-warning">
                      <TriangleAlert className="size-3.5" />
                      Pendiente
                    </span>
                  )}
                </TableCell>
                {editable && (
                  <TableCell className="text-right whitespace-nowrap">
                    <Accion etiqueta="Editar" onClick={() => onEditar(g)}>
                      <Pencil />
                    </Accion>
                    <Accion etiqueta="Borrar" onClick={() => onBorrar(g)}>
                      <Trash2 />
                    </Accion>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className={BORDES}>
              <TableCell className="font-semibold">Total del período</TableCell>
              <TableCell className="hidden md:table-cell" />
              <TableCell className="text-right font-semibold tabular-nums">{pesos(total)}</TableCell>
              <TableCell className="hidden sm:table-cell" />
              {editable && <TableCell />}
            </TableRow>
          </TableFooter>
        </Table>
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
