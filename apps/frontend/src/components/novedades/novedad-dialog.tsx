'use client';

import { FileText, X } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api';
import { novedadesService } from '@/services/novedades';
import type { Novedad } from '@/types/novedad';

/** Lo que el formulario le entrega a la página, ya limpio. */
export interface ValoresNovedad {
  titulo: string;
  cuerpo: string;
  fijada: boolean;
  /** Sólo en el alta: el backend no deja editar los adjuntos. */
  adjuntos: { url: string; nombre: string }[];
}

interface NovedadDialogProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  /** Si viene, edita esa novedad; si no, es un alta. */
  novedad?: Novedad;
  /** Debajo del título: el edificio, como en los modales del prototipo. */
  subtitulo: string;
  /** Guarda (crear o actualizar). Si tira, el error se muestra en el diálogo. */
  onGuardar: (valores: ValoresNovedad) => Promise<void>;
}

const MAX_ADJUNTOS = 5;

/**
 * Alta y edición de una novedad, con la forma de los modales del prototipo
 * (pantalla 08): título y edificio arriba, campos, y el pie gris con el aviso
 * de qué pasa al guardar. El contenido se monta al abrir, así cada apertura
 * arranca con los campos de esa novedad (o vacíos).
 */
export function NovedadDialog({ abierto, onOpenChange, novedad, subtitulo, onGuardar }: NovedadDialogProps) {
  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader className="-mx-4 border-b px-4 pb-4">
          <DialogTitle>{novedad ? 'Editar novedad' : 'Nueva novedad'}</DialogTitle>
          <DialogDescription>{subtitulo}</DialogDescription>
        </DialogHeader>
        <Formulario novedad={novedad} onGuardar={onGuardar} onCancelar={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

interface FormularioProps {
  novedad?: Novedad;
  onGuardar: (valores: ValoresNovedad) => Promise<void>;
  onCancelar: () => void;
}

function Formulario({ novedad, onGuardar, onCancelar }: FormularioProps) {
  const [titulo, setTitulo] = useState(novedad?.titulo ?? '');
  const [cuerpo, setCuerpo] = useState(novedad?.cuerpo ?? '');
  const [fijada, setFijada] = useState(novedad?.fijada ?? false);
  const [adjuntos, setAdjuntos] = useState<ValoresNovedad['adjuntos']>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subir(archivos: FileList | null) {
    if (!archivos?.length) return;
    setError(null);
    const lote = Array.from(archivos).slice(0, MAX_ADJUNTOS - adjuntos.length);
    setSubiendo(true);
    try {
      for (const archivo of lote) {
        const { url } = await novedadesService.subirAdjunto(archivo);
        setAdjuntos((prev) => [...prev, { url, nombre: archivo.name }]);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo subir el archivo.');
    } finally {
      setSubiendo(false);
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await onGuardar({ titulo: titulo.trim(), cuerpo: cuerpo.trim(), fijada, adjuntos });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar la novedad.');
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
            placeholder="Corte de agua el jueves de 9 a 13"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="cuerpo">Mensaje</FieldLabel>
          <Textarea
            id="cuerpo"
            required
            maxLength={5000}
            rows={5}
            value={cuerpo}
            onChange={(e) => setCuerpo(e.target.value)}
            placeholder="AySA trabaja en la conexión de la vereda. Les pedimos cargar reserva de agua."
          />
          <FieldDescription>Los vecinos lo leen tal cual, en el muro y en el mail.</FieldDescription>
        </Field>

        {!novedad && (
          <Field>
            <FieldLabel htmlFor="adjuntos">Adjuntos</FieldLabel>
            <Input
              id="adjuntos"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,application/pdf"
              disabled={subiendo || adjuntos.length >= MAX_ADJUNTOS}
              onChange={(e) => {
                void subir(e.target.files);
                e.target.value = '';
              }}
            />
            <FieldDescription>
              {subiendo
                ? 'Subiendo…'
                : `Imágenes o PDF de hasta 10 MB. Máximo ${MAX_ADJUNTOS}.`}
            </FieldDescription>
            {adjuntos.length > 0 && (
              <ul className="flex flex-col gap-1">
                {adjuntos.map((a) => (
                  <li key={a.url} className="flex items-center gap-2 text-sm">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{a.nombre}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Quitar ${a.nombre}`}
                      onClick={() => setAdjuntos((prev) => prev.filter((x) => x.url !== a.url))}
                    >
                      <X />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Field>
        )}

        <Field orientation="horizontal" className="rounded-lg bg-muted px-3 py-2.5">
          <Switch id="fijada" checked={fijada} onCheckedChange={setFijada} />
          <FieldLabel htmlFor="fijada" className="font-normal text-secondary-foreground">
            Fijarla arriba del muro
          </FieldLabel>
        </Field>
      </FieldGroup>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <DialogFooter className="sm:items-center">
        <p className="text-xs text-muted-foreground sm:mr-auto">
          {novedad
            ? 'Los cambios se ven en el muro al instante.'
            : 'Se publica en el muro y les llega por mail a los vecinos.'}
        </p>
        <Button type="button" variant="outline" onClick={onCancelar} disabled={enviando}>
          Cancelar
        </Button>
        <Button type="submit" disabled={enviando || subiendo}>
          {enviando ? 'Guardando…' : novedad ? 'Guardar cambios' : 'Publicar'}
        </Button>
      </DialogFooter>
    </form>
  );
}
