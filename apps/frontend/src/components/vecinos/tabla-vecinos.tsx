'use client';

import { KeyRound, Pencil } from 'lucide-react';
import { EstadoBadge } from '@/components/estado-badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { iniciales } from '@/lib/formato';
import type { Usuario } from '@/types/usuario';

const ENCABEZADO =
  'bg-muted hover:bg-muted [&_th]:text-xs [&_th]:font-semibold [&_th]:tracking-wider [&_th]:text-muted-foreground [&_th]:uppercase';
const BORDES = '[&>*:first-child]:pl-4 [&>*:last-child]:pr-4';

interface TablaVecinosProps {
  vecinos: Usuario[];
  onEditar: (vecino: Usuario) => void;
  onPassword: (vecino: Usuario) => void;
}

/** Los vecinos que hoy viven en el consorcio. Va adentro de una `Card` que pone la página. */
export function TablaVecinos({ vecinos, onEditar, onPassword }: TablaVecinosProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className={`${ENCABEZADO} ${BORDES}`}>
          <TableHead>Vecino</TableHead>
          <TableHead className="hidden md:table-cell">DNI</TableHead>
          <TableHead className="hidden lg:table-cell">Teléfono</TableHead>
          <TableHead className="hidden sm:table-cell">Cuenta</TableHead>
          <TableHead>
            <span className="sr-only">Acciones</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {vecinos.map((v) => (
          <TableRow key={v.id} className={BORDES}>
            <TableCell>
              <div className="flex items-center gap-3">
                <Avatar className="size-8">
                  {v.avatarUrl && <AvatarImage src={v.avatarUrl} alt="" />}
                  <AvatarFallback className="text-xs">{iniciales(v.nombre, v.apellido)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {v.nombre} {v.apellido}
                  </p>
                  <p className="max-w-44 truncate text-xs text-muted-foreground sm:max-w-xs">{v.email}</p>
                </div>
              </div>
            </TableCell>
            <TableCell className="hidden text-secondary-foreground tabular-nums md:table-cell">{v.dni || '—'}</TableCell>
            <TableCell className="hidden text-secondary-foreground tabular-nums lg:table-cell">
              {v.telefono || '—'}
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              <EstadoBadge dominio="cuenta" estado={v.activo ? 'ACTIVA' : 'INACTIVA'} />
            </TableCell>
            <TableCell className="text-right whitespace-nowrap">
              <Accion etiqueta="Editar datos" onClick={() => onEditar(v)}>
                <Pencil />
              </Accion>
              <Accion etiqueta="Nueva contraseña" onClick={() => onPassword(v)}>
                <KeyRound />
              </Accion>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
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

/** Las filas mientras carga: misma forma, sin datos. */
export function TablaVecinosEsqueleto() {
  return (
    <div>
      <div className="h-9 border-b bg-muted" />
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="hidden h-5 w-16 rounded-full sm:block" />
        </div>
      ))}
    </div>
  );
}
