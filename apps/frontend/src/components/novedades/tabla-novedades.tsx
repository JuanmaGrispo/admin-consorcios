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
import { Card } from '@/components/ui/card';
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
import { fechaDeInstante } from '@/lib/formato';
import type { Novedad, NovedadCambios } from '@/types/novedad';

interface TablaNovedadesProps {
  novedades: Novedad[];
  onEditar: (novedad: Novedad) => void;
  /** Fijar, desfijar, dar de baja o reactivar: todo es un PATCH. */
  onCambiar: (novedad: Novedad, cambios: NovedadCambios) => void;
}

/** El muro visto por quien lo administra: una fila por novedad, con sus acciones. */
export function TablaNovedades({ novedades, onEditar, onCambiar }: TablaNovedadesProps) {
  // Dar de baja la saca del muro de los vecinos: se confirma antes.
  const [aDarDeBaja, setADarDeBaja] = useState<Novedad | null>(null);

  return (
    <>
      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Novedad</TableHead>
              <TableHead className="hidden md:table-cell">Publicada</TableHead>
              <TableHead className="hidden lg:table-cell">Autor</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Lecturas</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {novedades.map((n) => (
              <TableRow key={n.id}>
                <TableCell className="max-w-64 whitespace-normal sm:max-w-md">
                  <div className="flex items-center gap-1.5 font-medium">
                    {n.fijada && <Pin className="size-3.5 shrink-0 text-primary" aria-label="Fijada" />}
                    <span className="truncate">{n.titulo}</span>
                  </div>
                  <p className="line-clamp-1 text-sm text-muted-foreground">{n.cuerpo}</p>
                  {n.novedadAdjuntos.length > 0 && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Paperclip className="size-3" />
                      {n.novedadAdjuntos.length} {n.novedadAdjuntos.length === 1 ? 'adjunto' : 'adjuntos'}
                    </p>
                  )}
                </TableCell>
                <TableCell className="hidden tabular-nums md:table-cell">
                  {n.publicadaAt ? fechaDeInstante(n.publicadaAt) : '—'}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {n.autor.nombre} {n.autor.apellido}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">
                  {n.lecturas ?? 0}
                </TableCell>
                <TableCell>
                  <EstadoBadge dominio="novedad" estado={n.activa ? 'ACTIVA' : 'INACTIVA'} />
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Acciones de ${n.titulo}`}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => onEditar(n)}>
                        <Pencil />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onCambiar(n, { fijada: !n.fijada })}>
                        {n.fijada ? <PinOff /> : <Pin />}
                        {n.fijada ? 'Desfijar' : 'Fijar arriba'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
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
      </Card>

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

/** La tabla mientras carga: misma forma, sin datos. */
export function TablaNovedadesEsqueleto() {
  return (
    <Card className="gap-0 py-0">
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
    </Card>
  );
}
