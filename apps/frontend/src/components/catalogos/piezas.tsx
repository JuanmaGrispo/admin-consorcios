'use client';

import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { TableCell, TableRow } from '@/components/ui/table';

/** Lo que recibe cada solapa de catálogos. */
export interface CatalogoProps {
  consorcioId: string;
  /** Los compartidos entre consorcios sólo los toca el superadmin. */
  esSuperAdmin: boolean;
}

/** De este consorcio o compartido por todos (lo administra la plataforma). */
export function Alcance({ compartido }: { compartido: boolean }) {
  return compartido ? (
    <Badge variant="secondary">Compartido</Badge>
  ) : (
    <span className="text-sm text-muted-foreground">Este consorcio</span>
  );
}

interface AccionesFilaProps {
  etiqueta: string;
  onEditar: () => void;
  onBorrar?: () => void;
  /** Para proveedores, que no se borran: "Dar de baja" / "Reactivar". */
  extra?: React.ReactNode;
}

export function AccionesFila({ etiqueta, onEditar, onBorrar, extra }: AccionesFilaProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Acciones de ${etiqueta}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEditar}>
          <Pencil />
          Editar
        </DropdownMenuItem>
        {extra}
        {onBorrar && (
          <DropdownMenuItem variant="destructive" onSelect={onBorrar}>
            <Trash2 />
            Borrar
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function FilasCargando({ columnas }: { columnas: number }) {
  return Array.from({ length: 4 }).map((_, i) => (
    <TableRow key={i}>
      {Array.from({ length: columnas }).map((_, j) => (
        <TableCell key={j} className={j === 0 ? 'pl-5' : undefined}>
          <Skeleton className={j === 0 ? 'h-5 w-40' : 'h-4 w-20'} />
        </TableCell>
      ))}
    </TableRow>
  ));
}
