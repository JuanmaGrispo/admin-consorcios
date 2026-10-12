'use client';

import { Download, Eye, FileText, MoreHorizontal, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { EstadoBadge } from '@/components/estado-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
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
import { fechaDeInstante, hora, porcentaje } from '@/lib/formato';
import type { Asamblea } from '@/types/asamblea';
import { dondeSeHace, TIPOS } from './etiquetas';

const ENCABEZADO =
  'bg-muted hover:bg-muted [&_th]:text-xs [&_th]:font-semibold [&_th]:tracking-wider [&_th]:text-muted-foreground [&_th]:uppercase';
const BORDES = '[&>*:first-child]:pl-4 [&>*:last-child]:pr-4';

interface TablaAsambleasProps {
  asambleas: Asamblea[];
  /** Baja el borrador del acta en PDF. */
  onBorradorActa: (asamblea: Asamblea) => void;
  /** Sólo se ofrece en borrador: el backend no borra una convocada. */
  onEliminar: (asamblea: Asamblea) => void;
}

/** Las asambleas del consorcio, la más próxima o reciente arriba. Va adentro de una `Card`. */
export function TablaAsambleas({ asambleas, onBorradorActa, onEliminar }: TablaAsambleasProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className={`${ENCABEZADO} ${BORDES}`}>
          <TableHead className="hidden md:table-cell">Fecha</TableHead>
          <TableHead>Asamblea</TableHead>
          <TableHead className="hidden lg:table-cell">Lugar</TableHead>
          <TableHead className="hidden sm:table-cell">Quórum</TableHead>
          <TableHead className="hidden sm:table-cell">Estado</TableHead>
          <TableHead>
            <span className="sr-only">Acciones</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {asambleas.map((a) => (
          <TableRow key={a.id} className={BORDES}>
            <TableCell className="hidden tabular-nums md:table-cell">
              <p className="font-medium">{fechaDeInstante(a.fechaHora)}</p>
              <p className="text-xs text-muted-foreground">{hora(a.fechaHora)}</p>
            </TableCell>
            <TableCell className="whitespace-normal">
              {/* En mobile la fila es título + acciones: el estado baja debajo del título. */}
              <div className="max-w-52 sm:max-w-md">
                <Link href={`/admin/asambleas/${a.id}`} className="block truncate font-medium hover:text-primary">
                  {a.titulo}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {TIPOS[a.tipo]}
                  <span className="tabular-nums md:hidden"> · {fechaDeInstante(a.fechaHora)}</span>
                </p>
                <div className="mt-1.5 sm:hidden">
                  <Estado asamblea={a} />
                </div>
              </div>
            </TableCell>
            <TableCell className="hidden text-secondary-foreground lg:table-cell">{dondeSeHace(a)}</TableCell>
            <TableCell className="hidden sm:table-cell">
              <Quorum asamblea={a} />
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              <Estado asamblea={a} />
            </TableCell>
            <TableCell>
              <div className="flex items-center justify-end gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      asChild
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-primary"
                    >
                      <Link href={`/admin/asambleas/${a.id}`} aria-label={`Ver ${a.titulo}`}>
                        <Eye />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Ver detalle</TooltipContent>
                </Tooltip>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground"
                      aria-label={`Más acciones de ${a.titulo}`}
                    >
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {a.actaUrl && (
                      <DropdownMenuItem asChild>
                        <a href={a.actaUrl} target="_blank" rel="noreferrer">
                          <FileText />
                          Ver acta firmada
                        </a>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onSelect={() => onBorradorActa(a)}>
                      <Download />
                      Borrador del acta en PDF
                    </DropdownMenuItem>
                    {a.estado === 'BORRADOR' && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => onEliminar(a)}>
                          <Trash2 />
                          Eliminar
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * Una cerrada se da por rechazada si tuvo votaciones con resultado y ninguna
 * salió aprobada. Las sin quórum no cuentan como rechazo: si todas quedaron
 * así, no se marca. Una cerrada sin quórum ya lo dice su propio estado.
 */
function fueRechazada(a: Asamblea): boolean {
  return a.estado === 'CERRADA' && a.votaciones.aprobadas === 0 && a.votaciones.rechazadas > 0;
}

/** El estado, si tiene acta firmada o fue rechazada, y cómo salieron sus votaciones. */
function Estado({ asamblea: a }: { asamblea: Asamblea }) {
  const { total, aprobadas, rechazadas } = a.votaciones;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        <EstadoBadge dominio="asamblea" estado={a.estado} />
        {a.actaUrl && (
          <Badge variant="outline" className="text-success">
            Acta firmada
          </Badge>
        )}
        {fueRechazada(a) && (
          <Badge variant="outline" className="text-destructive">
            Rechazada
          </Badge>
        )}
      </div>
      {total > 0 && (
        <p className="mt-1 text-xs text-muted-foreground tabular-nums">
          {aprobadas} {aprobadas === 1 ? 'aprobada' : 'aprobadas'} · {rechazadas}{' '}
          {rechazadas === 1 ? 'rechazada' : 'rechazadas'}
        </p>
      )}
    </div>
  );
}

/** El quórum con su barra: en verde si llegó al requerido, en amarillo si no. */
function Quorum({ asamblea: a }: { asamblea: Asamblea }) {
  if (a.quorumPorcentaje === null) return <span className="text-muted-foreground">—</span>;
  const alcanzado = a.quorumPorcentaje >= a.quorumRequerido;
  return (
    <div className="w-28 tabular-nums">
      <p className="text-sm">
        <span className={alcanzado ? 'text-success' : 'text-warning'}>{porcentaje(a.quorumPorcentaje)}</span>
        <span className="text-muted-foreground"> de {porcentaje(a.quorumRequerido, 2)}</span>
      </p>
      <Progress
        value={Math.min(a.quorumPorcentaje, 100)}
        aria-label="Quórum"
        className={`mt-1 ${alcanzado ? '[&>*]:bg-success' : '[&>*]:bg-warning'}`}
      />
    </div>
  );
}

/** Las filas mientras carga: misma forma, sin datos. */
export function TablaAsambleasEsqueleto() {
  return (
    <div>
      <div className="h-9 border-b bg-muted" />
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0">
          <Skeleton className="hidden h-4 w-20 md:block" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="hidden h-4 w-24 sm:block" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      ))}
    </div>
  );
}
