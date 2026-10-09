'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ApiError } from '@/lib/api';
import { fecha, pesos } from '@/lib/formato';
import type { CriterioProrrateo, LiquidacionCambios, LiquidacionDetalle } from '@/types/expensa';
import { CRITERIOS } from './etiquetas';

interface TarjetaProrrateoProps {
  liquidacion: LiquidacionDetalle;
  editable: boolean;
  /** Cada cambio se guarda al momento; si estaba previsualizada, el backend recalcula. */
  onCambiar: (cambios: LiquidacionCambios) => Promise<void>;
}

/** Cómo se reparte el total y cuándo vence (paso 2 de la pantalla 03). */
export function TarjetaProrrateo({ liquidacion, editable, onCambiar }: TarjetaProrrateoProps) {
  const [guardando, setGuardando] = useState(false);

  async function cambiar(cambios: LiquidacionCambios) {
    setGuardando(true);
    try {
      await onCambiar(cambios);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo guardar el cambio.');
    } finally {
      setGuardando(false);
    }
  }

  const emitida = liquidacion.estado === 'EMITIDA' || liquidacion.estado === 'CERRADA';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prorrateo</CardTitle>
        <CardDescription>{CRITERIOS[liquidacion.criterioProrrateo].ayuda}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <RadioGroup
          value={liquidacion.criterioProrrateo}
          onValueChange={(v) => cambiar({ criterioProrrateo: v as CriterioProrrateo })}
          disabled={!editable || guardando}
          aria-label="Criterio de prorrateo"
        >
          {Object.entries(CRITERIOS).map(([clave, { etiqueta }]) => (
            <Field key={clave} orientation="horizontal" className="rounded-lg border px-3 py-2.5">
              <RadioGroupItem id={`criterio-${clave}`} value={clave} />
              <FieldLabel htmlFor={`criterio-${clave}`} className="font-normal">
                {etiqueta}
              </FieldLabel>
            </Field>
          ))}
        </RadioGroup>

        <Field>
          <FieldLabel htmlFor="vencimiento">Vencimiento</FieldLabel>
          {editable ? (
            <Input
              id="vencimiento"
              type="date"
              // Se remonta si cambia en el backend, para no pisar lo que llegó.
              key={liquidacion.fechaVencimiento}
              defaultValue={liquidacion.fechaVencimiento.slice(0, 10)}
              disabled={guardando}
              onBlur={(e) => {
                const valor = e.target.value;
                if (valor && valor !== liquidacion.fechaVencimiento.slice(0, 10)) {
                  void cambiar({ fechaVencimiento: valor });
                }
              }}
            />
          ) : (
            <p className="font-medium tabular-nums">{fecha(liquidacion.fechaVencimiento)}</p>
          )}
          {editable && <FieldDescription>Se guarda al salir del campo.</FieldDescription>}
        </Field>

        <dl className="grid grid-cols-2 gap-3 border-t pt-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Total de gastos</dt>
            <dd className="font-semibold tabular-nums">{pesos(liquidacion.totalGastos)}</dd>
          </div>
          {emitida && (
            <div>
              <dt className="text-muted-foreground">Total emitido</dt>
              <dd className="font-semibold tabular-nums">{pesos(liquidacion.totalEmitido)}</dd>
            </div>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}
