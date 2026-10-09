'use client';

import { Plus, Wrench } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePedido } from '@/hooks/use-pedido';
import { ApiError } from '@/lib/api';
import { categoriasReclamoService } from '@/services/categorias-reclamo';
import type { CategoriaReclamo } from '@/types/catalogo';
import { ConfirmarAccion } from '@/components/confirmar-accion';
import { IconoCatalogo } from './icono-catalogo';
import { AccionesFila, Alcance, type CatalogoProps, FilasCargando } from './piezas';
import { SelectorIcono } from './selector-icono';

/** Los tipos de reclamo que el vecino elige al abrir uno (Plomería, Ascensor, Ruidos). */
export function CategoriasReclamoCatalogo({ consorcioId, esSuperAdmin }: CatalogoProps) {
  const { datos, error, recargar } = usePedido(
    `categorias:${consorcioId}`,
    () => categoriasReclamoService.listar(consorcioId),
    'No se pudieron cargar las categorías.',
  );
  // `null`: cerrado · `'nueva'`: alta · una categoría: edición.
  const [editando, setEditando] = useState<CategoriaReclamo | 'nueva' | null>(null);
  const [borrando, setBorrando] = useState<CategoriaReclamo | null>(null);

  const nueva = (
    <Button onClick={() => setEditando('nueva')}>
      <Plus />
      Nueva categoría
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">
          Los tipos de reclamo que el vecino elige al abrir uno. Una categoría con reclamos no se puede borrar.
        </p>
        {nueva}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {datos?.length === 0 ? (
        <EmptyState
          icono={Wrench}
          titulo="Todavía no hay categorías"
          descripcion="Sin categorías, los vecinos no pueden abrir reclamos. Empezá por las más comunes: plomería, electricidad, ascensor."
          accion={nueva}
        />
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Categoría</TableHead>
                <TableHead>Alcance</TableHead>
                <TableHead className="w-12 pr-5">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!datos && !error && <FilasCargando columnas={3} />}
              {datos?.map((c) => {
                const editable = c.consorcioId !== null || esSuperAdmin;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="pl-5">
                      <span className="flex items-center gap-2.5 font-medium">
                        <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                          <IconoCatalogo nombre={c.icono} />
                        </span>
                        {c.nombre}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Alcance compartido={c.consorcioId === null} />
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      {editable && (
                        <AccionesFila
                          etiqueta={c.nombre}
                          onEditar={() => setEditando(c)}
                          onBorrar={() => setBorrando(c)}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <DialogoCategoria
        key={editando === null ? 'cerrado' : editando === 'nueva' ? 'nueva' : editando.id}
        consorcioId={consorcioId}
        categoria={editando}
        onCerrar={() => setEditando(null)}
        onGuardada={recargar}
      />

      <ConfirmarAccion
        abierto={borrando !== null}
        titulo={`Borrar ${borrando?.nombre ?? 'la categoría'}`}
        descripcion="Deja de aparecer en el alta de reclamos. Si algún reclamo ya la usa, no se puede borrar."
        boton="Borrar"
        onConfirmar={async () => {
          if (!borrando) return;
          await categoriasReclamoService.borrar(borrando.id);
          recargar();
        }}
        onCerrar={() => setBorrando(null)}
      />
    </div>
  );
}

interface DialogoCategoriaProps {
  consorcioId: string;
  categoria: CategoriaReclamo | 'nueva' | null;
  onCerrar: () => void;
  onGuardada: () => void;
}

function DialogoCategoria({ consorcioId, categoria, onCerrar, onGuardada }: DialogoCategoriaProps) {
  const existente = categoria !== null && categoria !== 'nueva' ? categoria : null;
  const [nombre, setNombre] = useState(existente?.nombre ?? '');
  const [icono, setIcono] = useState(existente?.icono ?? '');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      if (existente) {
        await categoriasReclamoService.actualizar(existente.id, { nombre: nombre.trim(), icono: icono || undefined });
      } else {
        await categoriasReclamoService.crear({ consorcioId, nombre: nombre.trim(), icono: icono || undefined });
      }
      onCerrar();
      onGuardada();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar la categoría.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={categoria !== null} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent>
        <form onSubmit={guardar} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{existente ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
            <DialogDescription>Aparece en el alta de reclamos de los vecinos de este consorcio.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="categoria-nombre">Nombre</FieldLabel>
              <Input
                id="categoria-nombre"
                required
                maxLength={60}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Gas"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="categoria-icono">Ícono</FieldLabel>
              <SelectorIcono id="categoria-icono" valor={icono} onChange={setIcono} />
            </Field>
          </FieldGroup>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando || !nombre.trim()}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
