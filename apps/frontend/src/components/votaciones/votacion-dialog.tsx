'use client';

import { Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api';
import { instanteALocal, localAInstante } from '@/lib/fecha-input';
import { votacionesService } from '@/services/votaciones';
import type {
  CriterioDesempate,
  FormaConteo,
  MayoriaRequerida,
  PadronVotacion,
  VistaPadron,
  Votacion,
} from '@/types/votacion';
import { DESEMPATES, FORMAS_CONTEO, MAYORIAS, PADRONES } from './etiquetas';

const MAX_OPCIONES = 8;

/** Lo que el formulario le entrega a la página, ya limpio. */
export interface ValoresVotacion {
  titulo: string;
  descripcion: string | null;
  padron: PadronVotacion;
  formaConteo: FormaConteo;
  mayoria: MayoriaRequerida;
  desempate: CriterioDesempate;
  mostrarParcial: boolean;
  bloqueaConDeuda: boolean;
  permiteVotoAnticipado: boolean;
  /** Sólo en las independientes: las de asamblea usan la ventana de la asamblea. */
  apertura?: string;
  cierre?: string;
  /** Además de “A favor” y “En contra”, que siempre están. */
  opciones: string[];
}

interface VotacionDialogProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  consorcioId: string;
  /** Debajo del título: el edificio. */
  subtitulo: string;
  /** Si viene, edita esa votación (en borrador); si no, es un alta. */
  votacion?: Votacion;
  /** Si viene, la votación es un punto nuevo de esa asamblea y no pide fechas. */
  asamblea?: { id: string; titulo: string };
  /** Para precargar el título cuando nace de un punto del orden del día. */
  tituloInicial?: string;
  onGuardar: (valores: ValoresVotacion) => Promise<void>;
}

/**
 * Alta y edición de una votación (pantalla 08 del prototipo). Mientras el
 * administrador elige padrón y forma de conteo, muestra cuántas unidades
 * votarían y cuáles quedan sin votante. El contenido se monta al abrir.
 */
export function VotacionDialog({
  abierto,
  onOpenChange,
  consorcioId,
  subtitulo,
  votacion,
  asamblea,
  tituloInicial,
  onGuardar,
}: VotacionDialogProps) {
  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="-mx-4 border-b px-4 pb-4">
          <DialogTitle>{votacion ? 'Editar votación' : 'Nueva votación'}</DialogTitle>
          <DialogDescription>
            {asamblea ? `${subtitulo} · se suma al orden del día de “${asamblea.titulo}”` : subtitulo}
          </DialogDescription>
        </DialogHeader>
        <Formulario
          consorcioId={consorcioId}
          votacion={votacion}
          tituloInicial={tituloInicial}
          deAsamblea={asamblea !== undefined || votacion?.asambleaId != null}
          onGuardar={onGuardar}
          onCancelar={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

interface FormularioProps {
  consorcioId: string;
  votacion?: Votacion;
  tituloInicial?: string;
  deAsamblea: boolean;
  onGuardar: (valores: ValoresVotacion) => Promise<void>;
  onCancelar: () => void;
}

function Formulario({ consorcioId, votacion, tituloInicial, deAsamblea, onGuardar, onCancelar }: FormularioProps) {
  const [titulo, setTitulo] = useState(votacion?.titulo ?? tituloInicial ?? '');
  const [descripcion, setDescripcion] = useState(votacion?.descripcion ?? '');
  const [padron, setPadron] = useState<PadronVotacion>(votacion?.padron ?? 'SOLO_PROPIETARIOS');
  const [formaConteo, setFormaConteo] = useState<FormaConteo>(votacion?.formaConteo ?? 'POR_COEFICIENTE');
  const [mayoria, setMayoria] = useState<MayoriaRequerida>(votacion?.mayoria ?? 'SIMPLE_PRESENTES');
  const [desempate, setDesempate] = useState<CriterioDesempate>(votacion?.desempate ?? 'RECHAZADA');
  const [mostrarParcial, setMostrarParcial] = useState(votacion?.mostrarParcial ?? false);
  const [bloqueaConDeuda, setBloqueaConDeuda] = useState(votacion?.bloqueaConDeuda ?? false);
  const [anticipado, setAnticipado] = useState(votacion?.permiteVotoAnticipado ?? false);
  const [apertura, setApertura] = useState(votacion ? instanteALocal(votacion.apertura) : '');
  const [cierre, setCierre] = useState(votacion ? instanteALocal(votacion.cierre) : '');
  const [extras, setExtras] = useState<string[]>(
    votacion?.opcionVotos.filter((o) => !o.esFija).map((o) => o.etiqueta) ?? [],
  );
  const [vista, setVista] = useState<VistaPadron | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // La vista previa se pide de nuevo cada vez que cambia el padrón o el conteo.
  useEffect(() => {
    let vigente = true;
    votacionesService
      .vistaPadron({ consorcioId, padron, formaConteo })
      .then((v) => vigente && setVista(v))
      .catch(() => vigente && setVista(null)); // Sin vista previa el formulario anda igual.
    return () => {
      vigente = false;
    };
  }, [consorcioId, padron, formaConteo]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await onGuardar({
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || null,
        padron,
        formaConteo,
        mayoria,
        desempate,
        mostrarParcial,
        bloqueaConDeuda,
        permiteVotoAnticipado: deAsamblea && anticipado,
        apertura: deAsamblea ? undefined : localAInstante(apertura),
        cierre: deAsamblea ? undefined : localAInstante(cierre),
        opciones: extras.map((o) => o.trim()).filter(Boolean),
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar la votación.');
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="titulo">Qué se vota</FieldLabel>
          <Input
            id="titulo"
            required
            maxLength={150}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Cambio de la bomba de agua"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="descripcion">Detalle</FieldLabel>
          <Textarea
            id="descripcion"
            maxLength={4000}
            rows={3}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Presupuesto de $ 3.480.000 en 3 cuotas."
          />
          <FieldDescription>Los vecinos lo leen antes de votar.</FieldDescription>
        </Field>

        <Field>
          <FieldLabel>Opciones</FieldLabel>
          <p className="text-sm text-muted-foreground">
            “A favor” y “En contra” siempre están. Podés sumar otras, como “Abstención”.
          </p>
          {extras.map((extra, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                required
                maxLength={60}
                aria-label={`Opción ${i + 3}`}
                value={extra}
                onChange={(e) => setExtras((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Quitar opción"
                onClick={() => setExtras((prev) => prev.filter((_, j) => j !== i))}
              >
                <X />
              </Button>
            </div>
          ))}
          {extras.length < MAX_OPCIONES && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => setExtras((prev) => [...prev, ''])}
            >
              <Plus data-icon="inline-start" />
              Sumar opción
            </Button>
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel>Quién vota</FieldLabel>
            <Selector valor={padron} opciones={PADRONES} onCambiar={setPadron} />
          </Field>
          <Field>
            <FieldLabel>Cómo se cuenta</FieldLabel>
            <Selector valor={formaConteo} opciones={FORMAS_CONTEO} onCambiar={setFormaConteo} />
          </Field>
          <Field>
            <FieldLabel>Mayoría necesaria</FieldLabel>
            <Selector
              valor={mayoria}
              opciones={Object.fromEntries(Object.entries(MAYORIAS).map(([k, v]) => [k, v.etiqueta]))}
              onCambiar={setMayoria}
            />
            <FieldDescription>{MAYORIAS[mayoria].ayuda}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel>Si hay empate</FieldLabel>
            <Selector valor={desempate} opciones={DESEMPATES} onCambiar={setDesempate} />
          </Field>
        </div>

        {vista && (
          <div className="rounded-lg bg-muted px-3 py-2.5 text-sm">
            <p>
              Votarían <span className="font-semibold tabular-nums">{vista.habilitadas}</span>{' '}
              {vista.habilitadas === 1 ? 'unidad' : 'unidades'}.
            </p>
            {vista.sinVotante.length > 0 && (
              <p className="mt-1 text-muted-foreground">
                {vista.sinVotante.length} sin votante porque no tienen{' '}
                {padron === 'SOLO_PROPIETARIOS' ? 'propietario' : 'vecino'} registrado:{' '}
                {vista.sinVotante.map((u) => u.etiqueta).join(', ')}.
              </p>
            )}
          </div>
        )}

        {!deAsamblea && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="apertura">Abre</FieldLabel>
              <Input
                id="apertura"
                type="datetime-local"
                required
                value={apertura}
                onChange={(e) => setApertura(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="cierre">Cierra</FieldLabel>
              <Input
                id="cierre"
                type="datetime-local"
                required
                value={cierre}
                onChange={(e) => setCierre(e.target.value)}
              />
            </Field>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {deAsamblea && (
            <Interruptor
              id="anticipado"
              valor={anticipado}
              onCambiar={setAnticipado}
              etiqueta="Permitir votar desde la app antes de que empiece la asamblea"
            />
          )}
          <Interruptor
            id="parcial"
            valor={mostrarParcial}
            onCambiar={setMostrarParcial}
            etiqueta="Que el vecino vea el parcial antes del cierre"
          />
          <Interruptor
            id="deuda"
            valor={bloqueaConDeuda}
            onCambiar={setBloqueaConDeuda}
            etiqueta="Una unidad con expensas vencidas no vota"
          />
        </div>
      </FieldGroup>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <DialogFooter className="sm:items-center">
        <p className="text-xs text-muted-foreground sm:mr-auto">
          Queda en borrador: los vecinos la ven cuando la publiques.
        </p>
        <Button type="button" variant="outline" onClick={onCancelar} disabled={enviando}>
          Cancelar
        </Button>
        <Button type="submit" disabled={enviando}>
          {enviando ? 'Guardando…' : votacion ? 'Guardar cambios' : 'Crear votación'}
        </Button>
      </DialogFooter>
    </form>
  );
}

function Selector<T extends string>({
  valor,
  opciones,
  onCambiar,
}: {
  valor: T;
  opciones: Record<string, string>;
  onCambiar: (valor: T) => void;
}) {
  return (
    <Select value={valor} onValueChange={(v) => onCambiar(v as T)}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(opciones).map(([clave, etiqueta]) => (
          <SelectItem key={clave} value={clave}>
            {etiqueta}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Interruptor({
  id,
  valor,
  onCambiar,
  etiqueta,
}: {
  id: string;
  valor: boolean;
  onCambiar: (valor: boolean) => void;
  etiqueta: string;
}) {
  return (
    <Field orientation="horizontal" className="rounded-lg bg-muted px-3 py-2.5">
      <Switch id={id} checked={valor} onCheckedChange={onCambiar} />
      <FieldLabel htmlFor={id} className="font-normal text-secondary-foreground">
        {etiqueta}
      </FieldLabel>
    </Field>
  );
}
