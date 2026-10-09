'use client';

import { useState } from 'react';
import { MEDIOS } from '@/components/expensas/etiquetas';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiError } from '@/lib/api';
import { pesos, periodo } from '@/lib/formato';
import type { FilaCobranza } from '@/types/expensa';
import type { MedioManual, PagoManualInput } from '@/types/pago';

const MEDIOS_MANUALES: MedioManual[] = ['TRANSFERENCIA', 'EFECTIVO', 'OTRO'];

interface DialogoRegistrarPagoProps {
  /** Las boletas entre las que se elige. Con una sola, no se pregunta. */
  filas: FilaCobranza[];
  onRegistrar: (input: PagoManualInput, fila: FilaCobranza) => Promise<void>;
  onCerrar: () => void;
}

/**
 * Registrar un pago que llegó por fuera de Mercado Pago: transferencia,
 * efectivo. Nace aprobado y mueve el estado de la boleta.
 */
export function DialogoRegistrarPago({ filas, onRegistrar, onCerrar }: DialogoRegistrarPagoProps) {
  const [boletaId, setBoletaId] = useState(filas.length === 1 ? filas[0].id : '');
  const fila = filas.find((f) => f.id === boletaId);
  const [monto, setMonto] = useState(filas.length === 1 ? String(filas[0].saldo) : '');
  const [medio, setMedio] = useState<MedioManual>('TRANSFERENCIA');
  const [fechaPago, setFechaPago] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!fila) return;
    setError(null);
    setEnviando(true);
    try {
      await onRegistrar({ boletaId: fila.id, monto: Number(monto), medio, fechaPago: fechaPago || undefined }, fila);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar el pago.');
      setEnviando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pago{fila && filas.length === 1 ? ` de ${fila.unidad.etiqueta}` : ''}</DialogTitle>
          <DialogDescription>
            {fila
              ? `${periodo(fila.periodo)} · saldo ${pesos(fila.saldo)}`
              : 'Transferencia o efectivo: Mercado Pago se registra solo.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <FieldGroup>
            {filas.length > 1 && (
              <Field>
                <FieldLabel>Unidad</FieldLabel>
                <Select
                  value={boletaId}
                  onValueChange={(id) => {
                    setBoletaId(id);
                    setMonto(String(filas.find((f) => f.id === id)?.saldo ?? ''));
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Elegí la unidad" />
                  </SelectTrigger>
                  <SelectContent>
                    {filas.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.unidad.etiqueta} · debe {pesos(f.saldo)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="monto">Monto ($)</FieldLabel>
                <Input
                  id="monto"
                  type="number"
                  required
                  min={0.01}
                  max={fila?.saldo}
                  step="0.01"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                />
                <FieldDescription>Hasta el saldo. Menos queda como pago parcial.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel>Medio</FieldLabel>
                <Select value={medio} onValueChange={(v) => setMedio(v as MedioManual)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEDIOS_MANUALES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {MEDIOS[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="fecha-pago">Fecha del pago</FieldLabel>
                <Input id="fecha-pago" type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} />
                <FieldDescription>Vacío: hoy.</FieldDescription>
              </Field>
            </div>
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
            <Button type="submit" disabled={!fila || enviando}>
              {enviando ? 'Registrando…' : 'Registrar pago'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
