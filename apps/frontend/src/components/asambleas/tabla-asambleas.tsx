'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { EstadoBadge } from '@/components/estado-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fechaHora, porcentaje } from '@/lib/formato';
import type { Asamblea } from '@/types/asamblea';
import { dondeSeHace, TIPOS } from './etiquetas';

const ENCABEZADO =
  'bg-muted hover:bg-muted [&_th]:text-xs [&_th]:font-semibold [&_th]:tracking-wider [&_th]:text-muted-foreground [&_th]:uppercase';
const BORDES = '[&>*:first-child]:pl-4 [&>*:last-child]:pr-4';

/** Las asambleas del consorcio, la más próxima o reciente arriba. Va adentro de una `Card`. */
export function TablaAsambleas({ asambleas }: { asambleas: Asamblea[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className={`${ENCABEZADO} ${BORDES}`}>
          <TableHead>Asamblea</TableHead>
          <TableHead className="hidden md:table-cell">Fecha</TableHead>
          <TableHead className="hidden lg:table-cell">Lugar</TableHead>
          <TableHead className="hidden text-right sm:table-cell">Quórum</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>
            <span className="sr-only">Abrir</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {asambleas.map((a) => (
          <TableRow key={a.id} className={BORDES}>
            <TableCell className="whitespace-normal">
              <div className="max-w-44 sm:max-w-md">
                <Link href={`/admin/asambleas/${a.id}`} className="block truncate font-medium hover:text-primary">
                  {a.titulo}
                </Link>
                <p className="text-xs text-muted-foreground">{TIPOS[a.tipo]}</p>
              </div>
            </TableCell>
            <TableCell className="hidden text-secondary-foreground tabular-nums md:table-cell">
              {fechaHora(a.fechaHora)}
            </TableCell>
            <TableCell className="hidden text-secondary-foreground lg:table-cell">{dondeSeHace(a)}</TableCell>
            <TableCell className="hidden text-right tabular-nums sm:table-cell">
              {a.quorumPorcentaje === null ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <span className={a.quorumPorcentaje >= a.quorumRequerido ? 'text-success' : 'text-warning'}>
                  {porcentaje(a.quorumPorcentaje)}
                  <span className="text-muted-foreground"> / {porcentaje(a.quorumRequerido, 0)}</span>
                </span>
              )}
            </TableCell>
            <TableCell>
              <EstadoBadge dominio="asamblea" estado={a.estado} />
            </TableCell>
            <TableCell className="text-right">
              <Button
                asChild
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-primary"
              >
                <Link href={`/admin/asambleas/${a.id}`} aria-label={`Abrir ${a.titulo}`}>
                  <ChevronRight />
                </Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Las filas mientras carga: misma forma, sin datos. */
export function TablaAsambleasEsqueleto() {
  return (
    <div>
      <div className="h-9 border-b bg-muted" />
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0">
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="hidden h-4 w-32 md:block" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      ))}
    </div>
  );
}
