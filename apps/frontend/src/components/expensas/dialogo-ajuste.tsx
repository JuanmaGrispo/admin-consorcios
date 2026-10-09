'use client';

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
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { usePedido } from '@/hooks/use-pedido';
import { ApiError } from '@/lib/api';
import { pesos } from '@/lib/formato';
import { expensasService } from '@/services/expensas';
import type { FilaCobranza } from '@/types/expensa';

interface DialogoAjusteProps {
  fila: FilaCobranza;
  onGuardar: (ajuste: number, motivo: string) => Promise<void>;
  onCerrar: () => void;
}

/**
 * Ajuste manual de una boleta en previsualización: suma (o resta, en
 * negativo) al total. El motivo lo ve el vecino en su boleta.
 */
export function DialogoAjuste({ fila, onGuardar, onCerrar }: DialogoAjusteProps) {
  // La fila no trae el ajuste actual: se pide la boleta.
  const boleta = usePedido(`boleta:${fila.id}`, () => expensasService.obtenerBoleta(fila.id)).datos;

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar la boleta de {fila.unidad.etiqueta}</DialogTitle>
          <DialogDescription>Total calculado: {pesos(fila.emitido)}.</DialogDescription>
        </DialogHeader>
        {boleta ? (
          <Formulario
            ajusteInicial={boleta.ajusteManual}
            motivoInicial={boleta.motivoAjuste ?? ''}
            onGuardar={onGuardar}
            onCerrar={onCerrar}
          />
        ) : (
          <Skeleton className="h-32 w-full" />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Formulario({
  ajusteInicial,
  motivoInicial,
  onGuardar,
  onCerrar,
}: {
  ajusteInicial: number;
  motivoInicial: string;
  onGuardar: (ajuste: number, motivo: string) => Promise<void>;
  onCerrar: () => void;
}) {
  const [ajuste, setAjuste] = useState(ajusteInicial ? String(ajusteInicial) : '');
  const [motivo, setMotivo] = useState(motivoInicial);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await onGuardar(Number(ajuste || 0), motivo.trim());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el ajuste.');
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="ajuste">Ajuste ($)</FieldLabel>
          <Input
            id="ajuste"
            type="number"
            step="0.01"
            value={ajuste}
            onChange={(e) => setAjuste(e.target.value)}
            placeholder="-1500"
          />
          <FieldDescription>En negativo descuenta. En 0 saca el ajuste.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="motivo">Motivo</FieldLabel>
          <Input
            id="motivo"
            required={Number(ajuste || 0) !== 0}
            maxLength={200}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Bonificación por arreglo a cargo del vecino"
          />
          <FieldDescription>El vecino lo ve en el detalle de su boleta.</FieldDescription>
        </Field>
      </FieldGroup>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCerrar} disabled={enviando}>
          Cancelar
        </Button>
        <Button type="submit" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar ajuste'}
        </Button>
      </DialogFooter>
    </form>
  );
}
