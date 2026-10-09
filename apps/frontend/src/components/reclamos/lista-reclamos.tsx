'use client';

import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useState } from 'react';
import { IconoCatalogo } from '@/components/catalogos/icono-catalogo';
import { EstadoBadge } from '@/components/estado-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePedido } from '@/hooks/use-pedido';
import { fechaDeInstante } from '@/lib/formato';
import { reclamosService } from '@/services/reclamos';
import type { CategoriaReclamo } from '@/types/catalogo';
import type { EstadoReclamo, PrioridadReclamo } from '@/types/reclamo';

const TODOS = 'todos';
const POR_PAGINA = 20;

interface ListaReclamosProps {
  consorcioId: string;
  /** Sube cuando algo cambió afuera (un alta, una gestión): la lista se vuelve a pedir. */
  version: number;
  categorias: CategoriaReclamo[];
  seleccionado: string | null;
  onSeleccionar: (id: string) => void;
}

/** La bandeja "también disponible como lista" de la pantalla 04, con filtros y paginado. */
export function ListaReclamos({ consorcioId, version, categorias, seleccionado, onSeleccionar }: ListaReclamosProps) {
  const [estado, setEstado] = useState<EstadoReclamo | typeof TODOS>(TODOS);
  const [prioridad, setPrioridad] = useState<PrioridadReclamo | typeof TODOS>(TODOS);
  const [categoriaId, setCategoriaId] = useState(TODOS);
  const [texto, setTexto] = useState('');
  const [buscar, setBuscar] = useState('');
  const [pagina, setPagina] = useState(1);

  const clave = [consorcioId, version, estado, prioridad, categoriaId, buscar, pagina].join(':');
  const { datos, error } = usePedido(clave, () =>
    reclamosService.listar({
      consorcioId,
      estado: estado === TODOS ? undefined : estado,
      prioridad: prioridad === TODOS ? undefined : prioridad,
      categoriaId: categoriaId === TODOS ? undefined : categoriaId,
      buscar: buscar || undefined,
      pagina,
      limite: POR_PAGINA,
    }),
  );

  /** Cualquier filtro nuevo vuelve a la primera página. */
  function filtrar(aplicar: () => void) {
    aplicar();
    setPagina(1);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <form
          className="relative sm:col-span-2 lg:col-span-1"
          onSubmit={(e) => {
            e.preventDefault();
            filtrar(() => setBuscar(texto.trim()));
          }}
        >
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              // Borrar la búsqueda la saca sin tener que apretar Enter.
              if (!e.target.value) filtrar(() => setBuscar(''));
            }}
            placeholder="Buscar por código o texto"
            className="bg-card pl-8"
            aria-label="Buscar reclamos"
          />
        </form>
        <Select value={estado} onValueChange={(v) => filtrar(() => setEstado(v as EstadoReclamo))}>
          <SelectTrigger className="w-full bg-card" aria-label="Estado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los estados</SelectItem>
            <SelectItem value="NUEVO">Nuevo</SelectItem>
            <SelectItem value="EN_CURSO">En curso</SelectItem>
            <SelectItem value="ESPERANDO_PROVEEDOR">Esperando proveedor</SelectItem>
            <SelectItem value="RESUELTO">Resuelto</SelectItem>
          </SelectContent>
        </Select>
        <Select value={prioridad} onValueChange={(v) => filtrar(() => setPrioridad(v as PrioridadReclamo))}>
          <SelectTrigger className="w-full bg-card" aria-label="Prioridad">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas las prioridades</SelectItem>
            <SelectItem value="ALTA">Alta</SelectItem>
            <SelectItem value="MEDIA">Media</SelectItem>
            <SelectItem value="BAJA">Baja</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoriaId} onValueChange={(v) => filtrar(() => setCategoriaId(v))}>
          <SelectTrigger className="w-full bg-card sm:col-span-2 lg:col-span-1" aria-label="Categoría">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas las categorías</SelectItem>
            {categorias.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">Reclamo</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead className="hidden md:table-cell">Categoría</TableHead>
              <TableHead className="hidden sm:table-cell">Prioridad</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden pr-5 lg:table-cell">Abierto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!datos &&
              !error &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="pl-5">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="mt-1.5 h-3 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-10" />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Skeleton className="h-5 w-12 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </TableCell>
                  <TableCell className="hidden pr-5 lg:table-cell">
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                </TableRow>
              ))}

            {datos?.items.map((r) => (
              <TableRow
                key={r.id}
                onClick={() => onSeleccionar(r.id)}
                data-state={r.id === seleccionado ? 'selected' : undefined}
                className="cursor-pointer"
              >
                <TableCell className="max-w-72 pl-5 whitespace-normal">
                  <div className="line-clamp-1 font-medium">{r.descripcion}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{r.codigo}</div>
                </TableCell>
                <TableCell className="font-medium">{r.unidad.etiqueta}</TableCell>
                <TableCell className="hidden md:table-cell">
                  <span className="flex items-center gap-1.5 text-secondary-foreground">
                    <IconoCatalogo nombre={r.categoria?.icono} className="text-muted-foreground" />
                    {r.categoria?.nombre}
                  </span>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <EstadoBadge dominio="prioridad" estado={r.prioridad} />
                </TableCell>
                <TableCell>
                  <EstadoBadge dominio="reclamo" estado={r.estado} />
                </TableCell>
                <TableCell className="hidden pr-5 text-muted-foreground tabular-nums lg:table-cell">
                  {fechaDeInstante(r.createdAt)}
                </TableCell>
              </TableRow>
            ))}

            {datos?.items.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  No hay reclamos con estos filtros.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {datos && datos.paginas > 1 && (
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span className="tabular-nums">
            {datos.total} reclamos · página {datos.pagina} de {datos.paginas}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={pagina <= 1}
              onClick={() => setPagina((p) => p - 1)}
              aria-label="Página anterior"
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={pagina >= datos.paginas}
              onClick={() => setPagina((p) => p + 1)}
              aria-label="Página siguiente"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
