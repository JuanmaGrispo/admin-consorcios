'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { usePedido } from '@/hooks/use-pedido';
import { ApiError } from '@/lib/api';
import { proveedoresService } from '@/services/proveedores';
import { reclamosService } from '@/services/reclamos';
import type { Reclamo } from '@/types/reclamo';

interface DialogoAsignarProveedorProps {
  reclamo: Reclamo;
  abierto: boolean;
  onAbiertoChange: (abierto: boolean) => void;
  onAsignado: () => void;
}

/** Asigna o reasigna el proveedor. Si el reclamo estaba en NUEVO, el backend lo pasa a EN_CURSO. */
export function DialogoAsignarProveedor({
  reclamo,
  abierto,
  onAbiertoChange,
  onAsignado,
}: DialogoAsignarProveedorProps) {
  const proveedores = usePedido(
    abierto ? `proveedores:${reclamo.consorcioId}` : null,
    () => proveedoresService.listar({ consorcioId: reclamo.consorcioId }),
    'No se pudieron cargar los proveedores.',
  );
  const [proveedorId, setProveedorId] = useState(reclamo.proveedorId ?? '');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function asignar(e: React.FormEvent) {
    e.preventDefault();
    if (!proveedorId) {
      setError('Elegí un proveedor.');
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await reclamosService.asignarProveedor(reclamo.id, proveedorId, mensaje.trim() || undefined);
      setMensaje('');
      onAbiertoChange(false);
      onAsignado();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo asignar el proveedor.');
    } finally {
      setGuardando(false);
    }
  }

  const activos = proveedores.datos?.filter((p) => p.activo) ?? [];

  return (
    <Dialog open={abierto} onOpenChange={onAbiertoChange}>
      <DialogContent>
        <form onSubmit={asignar} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{reclamo.proveedorId ? 'Reasignar proveedor' : 'Asignar proveedor'}</DialogTitle>
            <DialogDescription>
              {reclamo.codigo} · {reclamo.unidad.etiqueta}. El vecino recibe un aviso con tu mensaje.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="proveedor">Proveedor</FieldLabel>
              {proveedores.datos ? (
                <Select value={proveedorId} onValueChange={setProveedorId}>
                  <SelectTrigger id="proveedor" className="w-full">
                    <SelectValue placeholder="Elegí un proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {activos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.razonSocial}
                        {p.rubro && <span className="text-muted-foreground"> · {p.rubro}</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                !proveedores.error && <Skeleton className="h-8 w-full" />
              )}
              {proveedores.datos && activos.length === 0 && (
                <FieldDescription>
                  No hay proveedores activos para este consorcio.{' '}
                  <Link href="/admin/catalogos?solapa=proveedores" className="text-primary underline">
                    Cargá uno en Catálogos
                  </Link>
                  .
                </FieldDescription>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="mensaje-asignacion">Mensaje para el vecino (opcional)</FieldLabel>
              <Textarea
                id="mensaje-asignacion"
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Coordinan la visita para el jueves de 9 a 12."
              />
            </Field>
          </FieldGroup>

          {(error || proveedores.error) && (
            <Alert variant="destructive">
              <AlertDescription>{error ?? proveedores.error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onAbiertoChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando || !proveedorId}>
              {guardando ? 'Asignando…' : 'Asignar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
