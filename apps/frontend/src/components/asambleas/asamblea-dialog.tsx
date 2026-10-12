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
import { instanteALocal, localAInstante } from '@/lib/fecha-input';
import type {
  AsambleaDetalle,
  ModalidadAsamblea,
  PuntoInput,
  TipoAsamblea,
} from '@/types/asamblea';
import { EditorPuntos, puntosParaEnviar, type PuntoEditable } from './editor-puntos';
import { MODALIDADES, TIPOS } from './etiquetas';

/** Lo que el formulario le entrega a la página, ya limpio. */
export interface ValoresAsamblea {
  titulo: string;
  tipo: TipoAsamblea;
  modalidad: ModalidadAsamblea;
  fechaHora: string;
  lugar: string | null;
  linkVideollamada: string | null;
  quorumRequerido: number;
  /** Sólo en el alta: el orden del día de una existente se edita aparte. */
  puntos: PuntoInput[];
}

interface AsambleaDialogProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  /** Debajo del título: el edificio. */
  subtitulo: string;
  /** Si viene, edita ese borrador; si no, es un alta. */
  asamblea?: AsambleaDetalle;
  /** A cuántas unidades les llega la citación, para el pie del alta. */
  unidades?: number;
  /** En el alta, `citar` dice si además de crearla hay que convocarla. */
  onGuardar: (valores: ValoresAsamblea, citar: boolean) => Promise<void>;
}

/**
 * Alta y edición de una asamblea en borrador (pantalla 07 del prototipo). El
 * orden del día se arma en el alta; después se edita desde el detalle.
 */
export function AsambleaDialog({
  abierto,
  onOpenChange,
  subtitulo,
  asamblea,
  unidades,
  onGuardar,
}: AsambleaDialogProps) {
  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="-mx-4 border-b px-4 pb-4">
          <DialogTitle>{asamblea ? 'Editar asamblea' : 'Nueva asamblea'}</DialogTitle>
          <DialogDescription>{subtitulo}</DialogDescription>
        </DialogHeader>
        <Formulario
          asamblea={asamblea}
          unidades={unidades}
          onGuardar={onGuardar}
          onCancelar={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function Formulario({
  asamblea,
  unidades,
  onGuardar,
  onCancelar,
}: {
  asamblea?: AsambleaDetalle;
  unidades?: number;
  onGuardar: (valores: ValoresAsamblea, citar: boolean) => Promise<void>;
  onCancelar: () => void;
}) {
  const [titulo, setTitulo] = useState(asamblea?.titulo ?? '');
  const [tipo, setTipo] = useState<TipoAsamblea>(asamblea?.tipo ?? 'ORDINARIA');
  const [modalidad, setModalidad] = useState<ModalidadAsamblea>(asamblea?.modalidad ?? 'PRESENCIAL');
  const [fechaHora, setFechaHora] = useState(asamblea ? instanteALocal(asamblea.fechaHora) : '');
  const [lugar, setLugar] = useState(asamblea?.lugar ?? '');
  const [link, setLink] = useState(asamblea?.linkVideollamada ?? '');
  const [quorum, setQuorum] = useState(String(asamblea?.quorumRequerido ?? 60));
  const [puntos, setPuntos] = useState<PuntoEditable[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pideLugar = modalidad !== 'DIGITAL';
  const pideLink = modalidad !== 'PRESENCIAL';
  // Para citar, el backend pide al menos un punto en el orden del día.
  const puedeCitar = puntos.some((p) => p.titulo.trim() !== '');

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Dos botones mandan el formulario: el de citar lo dice en su `name`.
    const citar = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('name') === 'citar';
    setError(null);
    setEnviando(true);
    try {
      await onGuardar(
        {
          titulo: titulo.trim(),
          tipo,
          modalidad,
          fechaHora: localAInstante(fechaHora),
          lugar: pideLugar ? lugar.trim() || null : null,
          linkVideollamada: pideLink ? link.trim() || null : null,
          quorumRequerido: Number(quorum),
          puntos: puntosParaEnviar(puntos),
        },
        citar,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar la asamblea.');
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="titulo">Título</FieldLabel>
          <Input
            id="titulo"
            required
            maxLength={150}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Asamblea ordinaria · 2º semestre 2026"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel>Tipo</FieldLabel>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoAsamblea)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIPOS).map(([clave, etiqueta]) => (
                  <SelectItem key={clave} value={clave}>
                    {etiqueta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Modalidad</FieldLabel>
            <Select value={modalidad} onValueChange={(v) => setModalidad(v as ModalidadAsamblea)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MODALIDADES).map(([clave, etiqueta]) => (
                  <SelectItem key={clave} value={clave}>
                    {etiqueta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="fecha">Fecha y hora</FieldLabel>
            <Input
              id="fecha"
              type="datetime-local"
              required
              value={fechaHora}
              onChange={(e) => setFechaHora(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="quorum">Quórum requerido (%)</FieldLabel>
            <Input
              id="quorum"
              type="number"
              required
              min={0}
              max={100}
              step="0.01"
              value={quorum}
              onChange={(e) => setQuorum(e.target.value)}
            />
            <FieldDescription>Porcentaje de coeficientes presentes para sesionar.</FieldDescription>
          </Field>
        </div>

        {pideLugar && (
          <Field>
            <FieldLabel htmlFor="lugar">Lugar</FieldLabel>
            <Input
              id="lugar"
              required
              maxLength={120}
              value={lugar}
              onChange={(e) => setLugar(e.target.value)}
              placeholder="SUM del edificio"
            />
          </Field>
        )}
        {pideLink && (
          <Field>
            <FieldLabel htmlFor="link">Link de la videollamada</FieldLabel>
            <Input
              id="link"
              type="url"
              required
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://meet.example.com/abc"
            />
          </Field>
        )}

        {!asamblea && (
          <Field>
            <FieldLabel>Orden del día</FieldLabel>
            <FieldDescription>
              Los puntos “con votación” después se vinculan a una votación. Se puede completar más tarde.
            </FieldDescription>
            <EditorPuntos puntos={puntos} onCambiar={setPuntos} />
          </Field>
        )}
      </FieldGroup>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <DialogFooter className="sm:items-center">
        <p className="text-xs text-muted-foreground sm:mr-auto">
          {asamblea
            ? 'Sigue en borrador: los vecinos la ven cuando la convoques.'
            : !puedeCitar
              ? 'Para citar hace falta al menos un punto en el orden del día.'
              : unidades
                ? `Al citar se notifica a ${unidades} ${unidades === 1 ? 'unidad' : 'unidades'}, con un recordatorio 48 h antes.`
                : 'Al citar se notifica a los vecinos, con un recordatorio 48 h antes.'}
        </p>
        <Button type="button" variant="ghost" onClick={onCancelar} disabled={enviando}>
          Cancelar
        </Button>
        {asamblea ? (
          <Button type="submit" disabled={enviando}>
            {enviando ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        ) : (
          <>
            <Button type="submit" name="borrador" variant="outline" disabled={enviando}>
              Guardar borrador
            </Button>
            <Button type="submit" name="citar" disabled={enviando || !puedeCitar}>
              {enviando ? 'Guardando…' : 'Crear y citar'}
            </Button>
          </>
        )}
      </DialogFooter>
    </form>
  );
}
