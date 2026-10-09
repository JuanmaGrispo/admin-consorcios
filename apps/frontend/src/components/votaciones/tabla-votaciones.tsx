'use client';

import { Eye } from 'lucide-react';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { fechaHora } from '@/lib/formato';
import type { Votacion } from '@/types/votacion';
import { MAYORIAS } from './etiquetas';

const ENCABEZADO =
  'bg-muted hover:bg-muted [&_th]:text-xs [&_th]:font-semibold [&_th]:tracking-wider [&_th]:text-muted-foreground [&_th]:uppercase';
const BORDES = '[&>*:first-child]:pl-4 [&>*:last-child]:pr-4';

interface TablaVotacionesProps {
  votaciones: Votacion[];
  onVer: (votacion: Votacion) => void;
}

/** Las votaciones del consorcio, independientes y de asamblea. Va adentro de una `Card`. */
export function TablaVotaciones({ votaciones, onVer }: TablaVotacionesProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className={`${ENCABEZADO} ${BORDES}`}>
          <TableHead>Votación</TableHead>
          <TableHead className="hidden md:table-cell">Vigencia</TableHead>
          <TableHead className="hidden lg:table-cell">Mayoría</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>
            <span className="sr-only">Acciones</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {votaciones.map((v) => (
          <TableRow key={v.id} className={`${BORDES} cursor-pointer`} onClick={() => onVer(v)}>
            <TableCell className="whitespace-normal">
              <div className="max-w-44 sm:max-w-md">
                <p className="truncate font-medium">{v.titulo}</p>
                <p className="text-xs text-muted-foreground">
                  {v.asambleaId ? 'De una asamblea' : 'Independiente'}
                </p>
              </div>
            </TableCell>
            <TableCell className="hidden text-secondary-foreground tabular-nums md:table-cell">
              {fechaHora(v.apertura)} → {fechaHora(v.cierre)}
            </TableCell>
            <TableCell className="hidden text-secondary-foreground lg:table-cell">
              {MAYORIAS[v.mayoria].etiqueta}
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap items-center gap-1.5">
                <EstadoBadge dominio="votacion" estado={v.estado} />
                {v.resultado && <EstadoBadge dominio="resultado" estado={v.resultado} />}
              </div>
            </TableCell>
            <TableCell className="text-right">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Ver votación"
                    className="text-muted-foreground hover:text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      onVer(v);
                    }}
                  >
                    <Eye />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Ver y gestionar</TooltipContent>
              </Tooltip>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Las filas mientras carga: misma forma, sin datos. */
export function TablaVotacionesEsqueleto() {
  return (
    <div>
      <div className="h-9 border-b bg-muted" />
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0">
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="hidden h-4 w-48 md:block" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}
