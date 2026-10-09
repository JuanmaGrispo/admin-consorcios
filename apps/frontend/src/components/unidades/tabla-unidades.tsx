'use client';

import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Users } from 'lucide-react';
import { EstadoBadge } from '@/components/estado-badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { porcentaje } from '@/lib/formato';
import type { Unidad } from '@/types/unidad';
import { TIPOS_UNIDAD } from './etiquetas';

const ENCABEZADO =
  'bg-muted hover:bg-muted [&_th]:text-xs [&_th]:font-semibold [&_th]:tracking-wider [&_th]:text-muted-foreground [&_th]:uppercase';
const BORDES = '[&>*:first-child]:pl-4 [&>*:last-child]:pr-4';

interface TablaUnidadesProps {
  unidades: Unidad[];
  onVecinos: (unidad: Unidad) => void;
  onEditar: (unidad: Unidad) => void;
  /** Dar de baja (con confirmación) o reactivar. */
  onCambiarActiva: (unidad: Unidad, activa: boolean) => void;
}

/** Las unidades del consorcio. Va adentro de una `Card` que pone la página. */
export function TablaUnidades({ unidades, onVecinos, onEditar, onCambiarActiva }: TablaUnidadesProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className={`${ENCABEZADO} ${BORDES}`}>
          <TableHead>Unidad</TableHead>
          <TableHead className="hidden md:table-cell">Tipo</TableHead>
          <TableHead className="text-right">Coef.</TableHead>
          <TableHead className="hidden text-right lg:table-cell">Sup.</TableHead>
          <TableHead className="hidden text-right sm:table-cell">Vecinos</TableHead>
          <TableHead className="hidden sm:table-cell">Estado</TableHead>
          <TableHead>
            <span className="sr-only">Acciones</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {unidades.map((u) => (
          <TableRow key={u.id} className={BORDES}>
            <TableCell>
              <p className="font-medium">{u.etiqueta}</p>
              {(u.piso || u.departamento) && (
                <p className="text-xs text-muted-foreground">
                  {[u.piso && `Piso ${u.piso}`, u.departamento && `Depto. ${u.departamento}`].filter(Boolean).join(' · ')}
                </p>
              )}
            </TableCell>
            <TableCell className="hidden text-secondary-foreground md:table-cell">{TIPOS_UNIDAD[u.tipo]}</TableCell>
            <TableCell className="text-right tabular-nums">{porcentaje(u.coeficiente, 4)}</TableCell>
            <TableCell className="hidden text-right text-secondary-foreground tabular-nums lg:table-cell">
              {u.metrosCuadrados != null ? `${u.metrosCuadrados.toLocaleString('es-AR')} m²` : '—'}
            </TableCell>
            <TableCell className="hidden text-right tabular-nums sm:table-cell">{u.cantidadVecinos ?? 0}</TableCell>
            <TableCell className="hidden sm:table-cell">
              <EstadoBadge dominio="unidad" estado={u.activa ? 'ACTIVA' : 'INACTIVA'} />
            </TableCell>
            <TableCell className="text-right whitespace-nowrap">
              <Accion etiqueta="Vecinos de la unidad" onClick={() => onVecinos(u)}>
                <Users />
              </Accion>
              <Accion etiqueta="Editar" onClick={() => onEditar(u)}>
                <Pencil />
              </Accion>
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
                  {/* En mobile no entran los íconos: viven acá. */}
                  <DropdownMenuItem className="sm:hidden" onSelect={() => onVecinos(u)}>
                    <Users />
                    Vecinos
                  </DropdownMenuItem>
                  <DropdownMenuItem className="sm:hidden" onSelect={() => onEditar(u)}>
                    <Pencil />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="sm:hidden" />
                  {u.activa ? (
                    <DropdownMenuItem variant="destructive" onSelect={() => onCambiarActiva(u, false)}>
                      <Archive />
                      Dar de baja
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onSelect={() => onCambiarActiva(u, true)}>
                      <ArchiveRestore />
                      Reactivar
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

/** Un ícono de acción de fila: gris, azul al pasar, con su nombre en el tooltip. */
function Accion({ etiqueta, onClick, children }: { etiqueta: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={etiqueta}
          onClick={onClick}
          className="hidden text-muted-foreground hover:text-primary sm:inline-flex"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{etiqueta}</TooltipContent>
    </Tooltip>
  );
}

/** Las filas mientras carga: misma forma, sin datos. */
export function TablaUnidadesEsqueleto() {
  return (
    <div>
      <div className="h-9 border-b bg-muted" />
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="hidden h-4 w-24 md:block" />
          <Skeleton className="ml-auto h-4 w-14" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}
