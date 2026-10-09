'use client';

import { Plus, Receipt } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePedido } from '@/hooks/use-pedido';
import { ApiError } from '@/lib/api';
import { rubrosGastoService } from '@/services/rubros-gasto';
import { NATURALEZAS_GASTO, type NaturalezaGasto, type RubroGasto } from '@/types/catalogo';
import { ConfirmarAccion } from '@/components/confirmar-accion';
import { IconoCatalogo } from './icono-catalogo';
import { AccionesFila, Alcance, type CatalogoProps, FilasCargando } from './piezas';
import { SelectorIcono } from './selector-icono';

const ETIQUETA_NATURALEZA = Object.fromEntries(NATURALEZAS_GASTO.map((n) => [n.valor, n.etiqueta])) as Record<
  NaturalezaGasto,
  string
>;

/** Cómo se agrupan los gastos de una liquidación (Sueldos, Luz, Mantenimiento). */
export function RubrosGastoCatalogo({ consorcioId, esSuperAdmin }: CatalogoProps) {
  const { datos, error, recargar } = usePedido(
    `rubros:${consorcioId}`,
    () => rubrosGastoService.listar(consorcioId),
    'No se pudieron cargar los rubros.',
  );
  const [editando, setEditando] = useState<RubroGasto | 'nuevo' | null>(null);
  const [borrando, setBorrando] = useState<RubroGasto | null>(null);

  const nuevo = (
    <Button onClick={() => setEditando('nuevo')}>
      <Plus />
      Nuevo rubro
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">
          Agrupan los gastos de la liquidación y el vecino los ve en el detalle de su boleta. Un rubro con
          gastos no se puede borrar.
        </p>
        {nuevo}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {datos?.length === 0 ? (
        <EmptyState
          icono={Receipt}
          titulo="Todavía no hay rubros"
          descripcion="Cargá los rubros antes de la primera liquidación: sueldos, servicios, mantenimiento, seguros."
          accion={nuevo}
        />
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Rubro</TableHead>
                <TableHead className="hidden sm:table-cell">Naturaleza</TableHead>
                <TableHead>Alcance</TableHead>
                <TableHead className="w-12 pr-5">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!datos && !error && <FilasCargando columnas={4} />}
              {datos?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="pl-5">
                    <span className="flex items-center gap-2.5 font-medium">
                      <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                        <IconoCatalogo nombre={r.icono} />
                      </span>
                      {r.nombre}
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant={r.naturaleza === 'ORDINARIO' ? 'outline' : 'secondary'}>
                      {ETIQUETA_NATURALEZA[r.naturaleza]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Alcance compartido={r.consorcioId === null} />
                  </TableCell>
                  <TableCell className="pr-5 text-right">
                    {(r.consorcioId !== null || esSuperAdmin) && (
                      <AccionesFila
                        etiqueta={r.nombre}
                        onEditar={() => setEditando(r)}
                        onBorrar={() => setBorrando(r)}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <DialogoRubro
        key={editando === null ? 'cerrado' : editando === 'nuevo' ? 'nuevo' : editando.id}
        consorcioId={consorcioId}
        rubro={editando}
        onCerrar={() => setEditando(null)}
        onGuardado={recargar}
      />

      <ConfirmarAccion
        abierto={borrando !== null}
        titulo={`Borrar ${borrando?.nombre ?? 'el rubro'}`}
        descripcion="Deja de ofrecerse al cargar gastos. Si algún gasto ya lo usa, no se puede borrar."
        boton="Borrar"
        onConfirmar={async () => {
          if (!borrando) return;
          await rubrosGastoService.borrar(borrando.id);
          recargar();
        }}
        onCerrar={() => setBorrando(null)}
      />
    </div>
  );
}

interface DialogoRubroProps {
  consorcioId: string;
  rubro: RubroGasto | 'nuevo' | null;
  onCerrar: () => void;
  onGuardado: () => void;
}

function DialogoRubro({ consorcioId, rubro, onCerrar, onGuardado }: DialogoRubroProps) {
  const existente = rubro !== null && rubro !== 'nuevo' ? rubro : null;
  const [nombre, setNombre] = useState(existente?.nombre ?? '');
  const [icono, setIcono] = useState(existente?.icono ?? '');
  const [naturaleza, setNaturaleza] = useState<NaturalezaGasto>(existente?.naturaleza ?? 'ORDINARIO');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    const datos = { nombre: nombre.trim(), icono: icono || undefined, naturaleza };
    try {
      if (existente) await rubrosGastoService.actualizar(existente.id, datos);
      else await rubrosGastoService.crear({ consorcioId, ...datos });
      onCerrar();
      onGuardado();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el rubro.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={rubro !== null} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent>
        <form onSubmit={guardar} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{existente ? 'Editar rubro' : 'Nuevo rubro'}</DialogTitle>
            <DialogDescription>Se ofrece al cargar los gastos de la liquidación de este consorcio.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="rubro-nombre">Nombre</FieldLabel>
              <Input
                id="rubro-nombre"
                required
                maxLength={80}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Sueldos y cargas sociales"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="rubro-icono">Ícono</FieldLabel>
                <SelectorIcono id="rubro-icono" valor={icono} onChange={setIcono} />
              </Field>
              <Field>
                <FieldLabel htmlFor="rubro-naturaleza">Naturaleza</FieldLabel>
                <Select value={naturaleza} onValueChange={(v) => setNaturaleza(v as NaturalezaGasto)}>
                  <SelectTrigger id="rubro-naturaleza" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NATURALEZAS_GASTO.map((n) => (
                      <SelectItem key={n.valor} value={n.valor}>
                        {n.etiqueta}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <FieldDescription>
              La naturaleza es la que toman por defecto los gastos nuevos. Cambiarla no toca los gastos ya cargados.
            </FieldDescription>
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
