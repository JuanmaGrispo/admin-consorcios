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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiError } from '@/lib/api';
import { porcentaje } from '@/lib/formato';
import type { TipoUnidad, Unidad } from '@/types/unidad';
import { TIPOS_UNIDAD } from './etiquetas';

/** Lo que el formulario le entrega a la página, ya convertido. */
export interface ValoresUnidad {
  etiqueta: string;
  piso?: string;
  departamento?: string;
  tipo: TipoUnidad;
  coeficiente: number;
  metrosCuadrados?: number;
}

interface UnidadDialogProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  /** Debajo del título: el edificio. */
  subtitulo: string;
  /** Si viene, edita esa unidad; si no, es un alta. */
  unidad?: Unidad;
  /** Lo que queda libre del 100% sin contar esta unidad: para avisar antes de guardar. */
  coeficienteLibre: number;
  onGuardar: (valores: ValoresUnidad) => Promise<void>;
}

/** Alta y edición de una unidad funcional. El contenido se monta al abrir. */
export function UnidadDialog({
  abierto,
  onOpenChange,
  subtitulo,
  unidad,
  coeficienteLibre,
  onGuardar,
}: UnidadDialogProps) {
  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="-mx-4 border-b px-4 pb-4">
          <DialogTitle>{unidad ? `Editar ${unidad.etiqueta}` : 'Nueva unidad'}</DialogTitle>
          <DialogDescription>{subtitulo}</DialogDescription>
        </DialogHeader>
        <Formulario
          unidad={unidad}
          coeficienteLibre={coeficienteLibre}
          onGuardar={onGuardar}
          onCancelar={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function Formulario({
  unidad,
  coeficienteLibre,
  onGuardar,
  onCancelar,
}: {
  unidad?: Unidad;
  coeficienteLibre: number;
  onGuardar: (valores: ValoresUnidad) => Promise<void>;
  onCancelar: () => void;
}) {
  const [etiqueta, setEtiqueta] = useState(unidad?.etiqueta ?? '');
  const [piso, setPiso] = useState(unidad?.piso ?? '');
  const [departamento, setDepartamento] = useState(unidad?.departamento ?? '');
  const [tipo, setTipo] = useState<TipoUnidad>(unidad?.tipo ?? 'DEPARTAMENTO');
  const [coeficiente, setCoeficiente] = useState(unidad ? String(unidad.coeficiente) : '');
  const [metros, setMetros] = useState(unidad?.metrosCuadrados != null ? String(unidad.metrosCuadrados) : '');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const excede = coeficiente !== '' && Number(coeficiente) > coeficienteLibre;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await onGuardar({
        etiqueta: etiqueta.trim(),
        piso: piso.trim() || undefined,
        departamento: departamento.trim() || undefined,
        tipo,
        coeficiente: Number(coeficiente),
        metrosCuadrados: metros ? Number(metros) : undefined,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar la unidad.');
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="etiqueta">Etiqueta</FieldLabel>
            <Input
              id="etiqueta"
              required
              maxLength={20}
              value={etiqueta}
              onChange={(e) => setEtiqueta(e.target.value)}
              placeholder="3º B"
            />
          </Field>
          <Field>
            <FieldLabel>Tipo</FieldLabel>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoUnidad)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIPOS_UNIDAD).map(([clave, etiquetaTipo]) => (
                  <SelectItem key={clave} value={clave}>
                    {etiquetaTipo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="piso">Piso</FieldLabel>
            <Input id="piso" maxLength={5} value={piso} onChange={(e) => setPiso(e.target.value)} placeholder="3" />
          </Field>
          <Field>
            <FieldLabel htmlFor="departamento">Departamento</FieldLabel>
            <Input
              id="departamento"
              maxLength={5}
              value={departamento}
              onChange={(e) => setDepartamento(e.target.value)}
              placeholder="B"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="coeficiente">Coeficiente (%)</FieldLabel>
            <Input
              id="coeficiente"
              type="number"
              required
              min={0.0001}
              max={100}
              step="0.0001"
              value={coeficiente}
              onChange={(e) => setCoeficiente(e.target.value)}
              placeholder="4.5"
            />
            <FieldDescription className={excede ? 'text-destructive' : undefined}>
              {excede
                ? `Pasa el 100%: quedan libres ${porcentaje(coeficienteLibre, 4)}.`
                : `Libre en el edificio: ${porcentaje(coeficienteLibre, 4)}.`}
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="metros">Superficie (m²)</FieldLabel>
            <Input
              id="metros"
              type="number"
              min={0.01}
              step="0.01"
              value={metros}
              onChange={(e) => setMetros(e.target.value)}
              placeholder="62"
            />
          </Field>
        </div>
      </FieldGroup>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <DialogFooter className="sm:items-center">
        <p className="text-xs text-muted-foreground sm:mr-auto">
          El coeficiente define cuánto paga de expensas y cuánto pesa su voto.
        </p>
        <Button type="button" variant="outline" onClick={onCancelar} disabled={enviando}>
          Cancelar
        </Button>
        <Button type="submit" disabled={enviando}>
          {enviando ? 'Guardando…' : unidad ? 'Guardar cambios' : 'Crear unidad'}
        </Button>
      </DialogFooter>
    </form>
  );
}
