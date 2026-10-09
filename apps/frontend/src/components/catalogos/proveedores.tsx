'use client';

import { Ban, Plus, RotateCcw, Search, Truck } from 'lucide-react';
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
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePedido } from '@/hooks/use-pedido';
import { ApiError } from '@/lib/api';
import { proveedoresService } from '@/services/proveedores';
import type { Proveedor, ProveedorInput } from '@/types/catalogo';
import { ConfirmarAccion } from '@/components/confirmar-accion';
import { AccionesFila, Alcance, type CatalogoProps, FilasCargando } from './piezas';

/** El formato que acepta el backend (y el largo de la columna): 30-71234567-9. */
const CUIT = /^\d{2}-\d{8}-\d$/;

/**
 * Plomeros, electricistas y demás que se asignan a los reclamos y cobran los
 * gastos. No se borran: se dan de baja, porque gastos y reclamos los referencian.
 */
export function ProveedoresCatalogo({ consorcioId, esSuperAdmin }: CatalogoProps) {
  const [texto, setTexto] = useState('');
  const [buscar, setBuscar] = useState('');
  const [inactivos, setInactivos] = useState(false);
  const { datos, error, recargar } = usePedido(
    `proveedores:${consorcioId}:${buscar}:${inactivos}`,
    () => proveedoresService.listar({ consorcioId, buscar: buscar || undefined, incluirInactivos: inactivos }),
    'No se pudieron cargar los proveedores.',
  );
  const [editando, setEditando] = useState<Proveedor | 'nuevo' | null>(null);
  const [dandoDeBaja, setDandoDeBaja] = useState<Proveedor | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  async function reactivar(p: Proveedor) {
    setErrorAccion(null);
    try {
      await proveedoresService.actualizar(p.id, { activo: true });
      recargar();
    } catch (err) {
      setErrorAccion(err instanceof ApiError ? err.message : 'No se pudo reactivar el proveedor.');
    }
  }

  const nuevo = (
    <Button onClick={() => setEditando('nuevo')}>
      <Plus />
      Nuevo proveedor
    </Button>
  );
  const sinFiltros = !buscar && !inactivos;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">
          Se asignan a los reclamos y cobran los gastos. No se borran: se dan de baja y quedan en la historia.
        </p>
        {nuevo}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form
          className="relative w-full sm:max-w-xs"
          onSubmit={(e) => {
            e.preventDefault();
            setBuscar(texto.trim());
          }}
        >
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              if (!e.target.value) setBuscar('');
            }}
            placeholder="Buscar por razón social o rubro"
            className="bg-card pl-8"
            aria-label="Buscar proveedores"
          />
        </form>
        <Field orientation="horizontal" className="w-auto">
          <Switch id="proveedores-inactivos" checked={inactivos} onCheckedChange={setInactivos} />
          <FieldLabel htmlFor="proveedores-inactivos" className="font-normal">
            Mostrar dados de baja
          </FieldLabel>
        </Field>
      </div>

      {(error || errorAccion) && (
        <Alert variant="destructive">
          <AlertDescription>{error ?? errorAccion}</AlertDescription>
        </Alert>
      )}

      {datos?.length === 0 && sinFiltros ? (
        <EmptyState
          icono={Truck}
          titulo="Todavía no hay proveedores"
          descripcion="Cargá a quienes trabajan en el edificio para poder asignarles los reclamos."
          accion={nuevo}
        />
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Proveedor</TableHead>
                <TableHead className="hidden md:table-cell">CUIT</TableHead>
                <TableHead className="hidden lg:table-cell">Contacto</TableHead>
                <TableHead className="hidden sm:table-cell">Alcance</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-12 pr-5">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!datos && !error && <FilasCargando columnas={6} />}
              {datos?.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="pl-5">
                    <div className="font-medium">{p.razonSocial}</div>
                    {p.rubro && <div className="mt-0.5 text-xs text-muted-foreground">{p.rubro}</div>}
                  </TableCell>
                  <TableCell className="hidden text-secondary-foreground tabular-nums md:table-cell">
                    {p.cuit ?? '—'}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="text-secondary-foreground">{p.telefono ?? '—'}</div>
                    {p.email && <div className="mt-0.5 text-xs text-muted-foreground">{p.email}</div>}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Alcance compartido={p.consorcioId === null} />
                  </TableCell>
                  <TableCell>
                    {p.activo ? <Badge variant="success">Activo</Badge> : <Badge variant="destructive">De baja</Badge>}
                  </TableCell>
                  <TableCell className="pr-5 text-right">
                    {(p.consorcioId !== null || esSuperAdmin) && (
                      <AccionesFila
                        etiqueta={p.razonSocial}
                        onEditar={() => setEditando(p)}
                        extra={
                          p.activo ? (
                            <DropdownMenuItem variant="destructive" onSelect={() => setDandoDeBaja(p)}>
                              <Ban />
                              Dar de baja
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onSelect={() => reactivar(p)}>
                              <RotateCcw />
                              Reactivar
                            </DropdownMenuItem>
                          )
                        }
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {datos?.length === 0 && !sinFiltros && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                    No hay proveedores que coincidan.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <DialogoProveedor
        key={editando === null ? 'cerrado' : editando === 'nuevo' ? 'nuevo' : editando.id}
        consorcioId={consorcioId}
        proveedor={editando}
        onCerrar={() => setEditando(null)}
        onGuardado={recargar}
      />

      <ConfirmarAccion
        abierto={dandoDeBaja !== null}
        titulo={`Dar de baja a ${dandoDeBaja?.razonSocial ?? 'el proveedor'}`}
        descripcion="Deja de ofrecerse para asignar reclamos y cargar gastos. Lo que ya tiene asignado queda como está, y lo podés reactivar cuando quieras."
        boton="Dar de baja"
        onConfirmar={async () => {
          if (!dandoDeBaja) return;
          await proveedoresService.actualizar(dandoDeBaja.id, { activo: false });
          recargar();
        }}
        onCerrar={() => setDandoDeBaja(null)}
      />
    </div>
  );
}

interface Campos {
  razonSocial: string;
  cuit: string;
  rubro: string;
  email: string;
  telefono: string;
}

interface DialogoProveedorProps {
  consorcioId: string;
  proveedor: Proveedor | 'nuevo' | null;
  onCerrar: () => void;
  onGuardado: () => void;
}

function DialogoProveedor({ consorcioId, proveedor, onCerrar, onGuardado }: DialogoProveedorProps) {
  const existente = proveedor !== null && proveedor !== 'nuevo' ? proveedor : null;
  const [campos, setCampos] = useState<Campos>({
    razonSocial: existente?.razonSocial ?? '',
    cuit: existente?.cuit ?? '',
    rubro: existente?.rubro ?? '',
    email: existente?.email ?? '',
    telefono: existente?.telefono ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cuitInvalido = campos.cuit.trim() !== '' && !CUIT.test(campos.cuit.trim());

  function set(campo: keyof Campos, valor: string) {
    setCampos((prev) => ({ ...prev, [campo]: valor }));
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (cuitInvalido) return;
    setGuardando(true);
    setError(null);
    // Vacío viaja como undefined: el backend valida formato en lo que llega.
    const datos: Omit<ProveedorInput, 'consorcioId'> = {
      razonSocial: campos.razonSocial.trim(),
      cuit: campos.cuit.trim() || undefined,
      rubro: campos.rubro.trim() || undefined,
      email: campos.email.trim() || undefined,
      telefono: campos.telefono.trim() || undefined,
    };
    try {
      if (existente) await proveedoresService.actualizar(existente.id, datos);
      else await proveedoresService.crear({ consorcioId, ...datos });
      onCerrar();
      onGuardado();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el proveedor.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={proveedor !== null} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <form onSubmit={guardar} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{existente ? 'Editar proveedor' : 'Nuevo proveedor'}</DialogTitle>
            <DialogDescription>Queda disponible para los reclamos y gastos de este consorcio.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="proveedor-razon">Razón social</FieldLabel>
              <Input
                id="proveedor-razon"
                required
                maxLength={150}
                value={campos.razonSocial}
                onChange={(e) => set('razonSocial', e.target.value)}
                placeholder="Plomería Rivas SRL"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={cuitInvalido || undefined}>
                <FieldLabel htmlFor="proveedor-cuit">CUIT</FieldLabel>
                <Input
                  id="proveedor-cuit"
                  inputMode="numeric"
                  maxLength={13}
                  value={campos.cuit}
                  onChange={(e) => set('cuit', e.target.value)}
                  placeholder="30-71234567-9"
                  aria-invalid={cuitInvalido || undefined}
                />
                {cuitInvalido && <FieldError>Con guiones: 30-71234567-9.</FieldError>}
              </Field>
              <Field>
                <FieldLabel htmlFor="proveedor-rubro">Rubro</FieldLabel>
                <Input
                  id="proveedor-rubro"
                  maxLength={60}
                  value={campos.rubro}
                  onChange={(e) => set('rubro', e.target.value)}
                  placeholder="Plomería"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="proveedor-email">Email</FieldLabel>
                <Input
                  id="proveedor-email"
                  type="email"
                  maxLength={150}
                  value={campos.email}
                  onChange={(e) => set('email', e.target.value)}
                  placeholder="contacto@plomeriarivas.com"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="proveedor-telefono">Teléfono</FieldLabel>
                <Input
                  id="proveedor-telefono"
                  type="tel"
                  maxLength={30}
                  value={campos.telefono}
                  onChange={(e) => set('telefono', e.target.value)}
                  placeholder="+54 11 4567-8910"
                />
              </Field>
            </div>
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
            <Button type="submit" disabled={guardando || !campos.razonSocial.trim() || cuitInvalido}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
