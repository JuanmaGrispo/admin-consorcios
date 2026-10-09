'use client';

import { Archive, ArchiveRestore, MoreHorizontal, Paperclip, Pencil, Pin, PinOff } from 'lucide-react';
import { useState } from 'react';
import { EstadoBadge } from '@/components/estado-badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { fechaDeInstante } from '@/lib/formato';
import type { Novedad, NovedadCambios } from '@/types/novedad';

/**
 * El encabezado de las tablas del prototipo (pantalla 02): fondo gris,
 * mayúsculas chicas y un poco más de aire en los bordes.
 */
const ENCABEZADO =
  'bg-muted hover:bg-muted [&_th]:text-xs [&_th]:font-semibold [&_th]:tracking-wider [&_th]:text-muted-foreground [&_th]:uppercase';
const BORDES = '[&>*:first-child]:pl-4 [&>*:last-child]:pr-4';

interface TablaNovedadesProps {
  novedades: Novedad[];
  onEditar: (novedad: Novedad) => void;
  /** Fijar, desfijar, dar de baja o reactivar: todo es un PATCH. */
  onCambiar: (novedad: Novedad, cambios: NovedadCambios) => void;
}

/**
 * El muro visto por quien lo administra: una fila por novedad. Las acciones
 * frecuentes van a la vista y el resto en "más acciones", como en la grilla
 * de cobranzas. Va adentro de una `Card` que pone la página, con los filtros
 * arriba y la paginación abajo.
 */
export function TablaNovedades({ novedades, onEditar, onCambiar }: TablaNovedadesProps) {
  // Dar de baja la saca del muro de los vecinos: se confirma antes.
  const [aDarDeBaja, setADarDeBaja] = useState<Novedad | null>(null);

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className={`${ENCABEZADO} ${BORDES}`}>
            <TableHead>Novedad</TableHead>
            <TableHead className="hidden md:table-cell">Publicada</TableHead>
            <TableHead className="hidden lg:table-cell">Autor</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Leída por</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>
              <span className="sr-only">Acciones</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {novedades.map((n) => (
            <TableRow key={n.id} className={BORDES}>
              <TableCell className="whitespace-normal">
                {/* El límite va en un div: las celdas de tabla ignoran max-width. */}
                <div className="max-w-44 sm:max-w-md">
                  <div className="flex items-center gap-1.5 font-medium">
                    {n.fijada && <Pin className="size-3.5 shrink-0 text-primary" aria-label="Fijada" />}
                    <span className="truncate">{n.titulo}</span>
                  </div>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{n.cuerpo}</p>
                  {n.novedadAdjuntos.length > 0 && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Paperclip className="size-3" />
                      {n.novedadAdjuntos.length} {n.novedadAdjuntos.length === 1 ? 'adjunto' : 'adjuntos'}
                    </p>
                  )}
                </div>
              </TableCell>
              <TableCell className="hidden text-secondary-foreground tabular-nums md:table-cell">
                {n.publicadaAt ? fechaDeInstante(n.publicadaAt) : '—'}
              </TableCell>
              <TableCell className="hidden text-secondary-foreground lg:table-cell">
                {n.autor.nombre} {n.autor.apellido}
              </TableCell>
              <TableCell className="hidden text-right tabular-nums sm:table-cell">
                {n.lecturas ?? 0} {n.lecturas === 1 ? 'vecino' : 'vecinos'}
              </TableCell>
              <TableCell>
                <EstadoBadge dominio="novedad" estado={n.activa ? 'ACTIVA' : 'INACTIVA'} />
              </TableCell>
              <TableCell className="text-right whitespace-nowrap">
                <Accion etiqueta="Editar" onClick={() => onEditar(n)}>
                  <Pencil />
                </Accion>
                <Accion
                  etiqueta={n.fijada ? 'Desfijar' : 'Fijar arriba del muro'}
                  onClick={() => onCambiar(n, { fijada: !n.fijada })}
                >
                  {n.fijada ? <PinOff /> : <Pin />}
                </Accion>
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
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
                    </TooltipTrigger>
                    <TooltipContent>Más acciones</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="end">
                    {/* En mobile no entran los íconos: editar y fijar viven acá. */}
                    <DropdownMenuItem className="sm:hidden" onSelect={() => onEditar(n)}>
                      <Pencil />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="sm:hidden"
                      onSelect={() => onCambiar(n, { fijada: !n.fijada })}
                    >
                      {n.fijada ? <PinOff /> : <Pin />}
                      {n.fijada ? 'Desfijar' : 'Fijar arriba del muro'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="sm:hidden" />
                    {n.activa ? (
                      <DropdownMenuItem variant="destructive" onSelect={() => setADarDeBaja(n)}>
                        <Archive />
                        Dar de baja
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onSelect={() => onCambiar(n, { activa: true })}>
                        <ArchiveRestore />
                        Volver a publicar
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog open={aDarDeBaja !== null} onOpenChange={(abierto) => !abierto && setADarDeBaja(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Dar de baja “{aDarDeBaja?.titulo}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Deja de verse en el muro de los vecinos. Podés volver a publicarla cuando quieras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => aDarDeBaja && onCambiar(aDarDeBaja, { activa: false })}
            >
              Dar de baja
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Un ícono de acción de fila: gris, azul al pasar, con su nombre en el tooltip. */
function Accion({
  etiqueta,
  onClick,
  children,
}: {
  etiqueta: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
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
export function TablaNovedadesEsqueleto() {
  return (
    <div>
      <div className="h-9 border-b bg-muted" />
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0">
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="hidden h-4 w-20 md:block" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}
