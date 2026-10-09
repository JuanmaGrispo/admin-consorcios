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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ApiError } from '@/lib/api';
import type { CriterioProrrateo, LiquidacionInput } from '@/types/expensa';
import { CRITERIOS } from './etiquetas';

interface DialogoNuevaLiquidacionProps {
  /** Debajo del título: el edificio. */
  subtitulo: string;
  /** El período que sigue al último: precarga el campo. */
  periodoSugerido: string;
  onCrear: (input: Omit<LiquidacionInput, 'consorcioId'>) => Promise<void>;
  onCerrar: () => void;
}

/** Abrir la liquidación de un período: nace en borrador, lista para cargar gastos. */
export function DialogoNuevaLiquidacion({ subtitulo, periodoSugerido, onCrear, onCerrar }: DialogoNuevaLiquidacionProps) {
  const [periodo, setPeriodo] = useState(periodoSugerido);
  const [criterio, setCriterio] = useState<CriterioProrrateo>('COEFICIENTE');
  const [vencimiento, setVencimiento] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await onCrear({ periodo, criterioProrrateo: criterio, fechaVencimiento: vencimiento || undefined });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo abrir la liquidación.');
      setEnviando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="-mx-4 border-b px-4 pb-4">
          <DialogTitle>Nueva liquidación</DialogTitle>
          <DialogDescription>{subtitulo}</DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="periodo">Período</FieldLabel>
              <Input id="periodo" type="month" required value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
              <FieldDescription>Una por período, siempre posterior al último emitido.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel>Prorrateo</FieldLabel>
              <RadioGroup value={criterio} onValueChange={(v) => setCriterio(v as CriterioProrrateo)}>
                {Object.entries(CRITERIOS).map(([clave, { etiqueta, ayuda }]) => (
                  <Field key={clave} orientation="horizontal" className="items-start rounded-lg border px-3 py-2.5">
                    <RadioGroupItem id={`nuevo-${clave}`} value={clave} className="mt-0.5" />
                    <FieldLabel htmlFor={`nuevo-${clave}`} className="flex-col items-start gap-0.5 font-normal">
                      <span className="font-medium">{etiqueta}</span>
                      <span className="text-xs text-muted-foreground">{ayuda}</span>
                    </FieldLabel>
                  </Field>
                ))}
              </RadioGroup>
            </Field>
            <Field>
              <FieldLabel htmlFor="vencimiento">Vencimiento</FieldLabel>
              <Input id="vencimiento" type="date" value={vencimiento} onChange={(e) => setVencimiento(e.target.value)} />
              <FieldDescription>Vacío: el día de vencimiento del consorcio, en el mes siguiente.</FieldDescription>
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
            <Button type="submit" disabled={!periodo || enviando}>
              {enviando ? 'Abriendo…' : 'Abrir liquidación'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
