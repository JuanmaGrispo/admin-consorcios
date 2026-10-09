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
import { Field, FieldLabel } from '@/components/ui/field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiError } from '@/lib/api';
import type { VotacionDetalle } from '@/types/votacion';

interface DialogoVotarProps {
  votacion: VotacionDetalle;
  /** La unidad activa del vecino: si todavía no votó con ella, viene elegida. */
  unidadActivaId: string;
  onVotar: (opcionId: string, unidadId: string) => Promise<void>;
  onCerrar: () => void;
}

/**
 * Emitir el voto. Es una sola vez por unidad y no se puede cambiar, así que
 * el botón dice “Confirmar voto” y el aviso lo repite antes de enviar.
 */
export function DialogoVotar({ votacion, unidadActivaId, onVotar, onCerrar }: DialogoVotarProps) {
  const pendientes = (votacion.misUnidades ?? []).filter((u) => !u.voto);
  const [unidadId, setUnidadId] = useState(
    pendientes.find((u) => u.unidadId === unidadActivaId)?.unidadId ?? pendientes[0]?.unidadId ?? '',
  );
  const [opcionId, setOpcionId] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unidad = pendientes.find((u) => u.unidadId === unidadId);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await onVotar(opcionId, unidadId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar el voto.');
      setEnviando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{votacion.titulo}</DialogTitle>
          <DialogDescription>
            {unidad ? `Tu voto vale ${unidad.pesoPorcentaje.toLocaleString('es-AR')}%. ` : ''}
            Se vota una sola vez y no se puede cambiar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="flex flex-col gap-4">
          {pendientes.length > 1 && (
            <Field>
              <FieldLabel>Votás por</FieldLabel>
              <Select value={unidadId} onValueChange={setUnidadId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pendientes.map((u) => (
                    <SelectItem key={u.unidadId} value={u.unidadId}>
                      {u.etiqueta}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          <RadioGroup value={opcionId} onValueChange={setOpcionId} aria-label="Tu voto">
            {votacion.opcionVotos.map((o) => (
              <Field key={o.id} orientation="horizontal" className="rounded-lg border px-3 py-3">
                <RadioGroupItem id={o.id} value={o.id} />
                <FieldLabel htmlFor={o.id} className="flex-1 font-medium">
                  {o.etiqueta}
                </FieldLabel>
              </Field>
            ))}
          </RadioGroup>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCerrar} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!opcionId || !unidadId || enviando}>
              {enviando ? 'Enviando…' : 'Confirmar voto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
