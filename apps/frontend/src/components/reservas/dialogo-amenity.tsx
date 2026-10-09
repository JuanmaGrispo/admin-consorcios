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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api';
import type { Amenity, AmenityCambios } from '@/types/reserva';
import { ICONOS_AMENITY, iconoSugerido } from './icono-amenity';
import { hhmm } from './tiempo';

/** "Franjas de…": horario libre o turnos fijos desde la apertura. */
const FRANJAS = [
  { valor: 'libre', etiqueta: 'Horario libre' },
  { valor: '60', etiqueta: 'Turnos de 1 hora' },
  { valor: '120', etiqueta: 'Turnos de 2 horas' },
  { valor: '180', etiqueta: 'Turnos de 3 horas' },
  { valor: '240', etiqueta: 'Turnos de 4 horas' },
  { valor: '360', etiqueta: 'Turnos de 6 horas' },
];

/** Lo que entrega el formulario, ya convertido. */
export type ValoresAmenity = AmenityCambios & { nombre: string };

interface DialogoAmenityProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  /** Si viene, lo configura; si no, es un alta. */
  amenity?: Amenity;
  subtitulo: string;
  /** Crea o actualiza. Si tira, el error se muestra en el diálogo. */
  onGuardar: (valores: ValoresAmenity) => Promise<void>;
}

/** "Configurar amenity" de la pantalla 05, con la forma del modal 08. Sirve también para el alta. */
export function DialogoAmenity({ abierto, onOpenChange, amenity, subtitulo, onGuardar }: DialogoAmenityProps) {
  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="-mx-4 border-b px-4 pb-4">
          <DialogTitle>{amenity ? `Configurar ${amenity.nombre}` : 'Nuevo amenity'}</DialogTitle>
          <DialogDescription>{subtitulo}</DialogDescription>
        </DialogHeader>
        <Formulario amenity={amenity} onGuardar={onGuardar} onCancelar={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

/** Todo string mientras se edita; se convierte al guardar. */
function inicial(a?: Amenity) {
  return {
    nombre: a?.nombre ?? '',
    // Sin ícono cargado, el que sugiere el nombre: guardar no le cambia la cara al amenity.
    icono: (a && iconoSugerido(a)) ?? 'deck',
    cupoPersonas: a?.cupoPersonas ? String(a.cupoPersonas) : '',
    lugares: String(a?.lugares ?? 1),
    horaApertura: a ? hhmm(a.horaApertura) : '10:00',
    horaCierre: a ? hhmm(a.horaCierre) : '22:00',
    franja: a?.duracionFranjaMinutos ? String(a.duracionFranjaMinutos) : 'libre',
    duracionMaximaHoras: a?.duracionMaximaHoras ? String(a.duracionMaximaHoras) : '',
    anticipacionMinimaHoras: String(a?.anticipacionMinimaHoras ?? 0),
    cancelacionMinimaHoras: String(a?.cancelacionMinimaHoras ?? 0),
    montoSena: String(a?.montoSena ?? 0),
    diasDevolucionSena: String(a?.diasDevolucionSena ?? 2),
    requiereAprobacion: a?.requiereAprobacion ?? true,
    bloqueaConDeuda: a?.bloqueaConDeuda ?? false,
    reglamento: a?.reglamento ?? '',
    activo: a?.activo ?? true,
  };
}

function Formulario({
  amenity,
  onGuardar,
  onCancelar,
}: {
  amenity?: Amenity;
  onGuardar: DialogoAmenityProps['onGuardar'];
  onCancelar: () => void;
}) {
  const [c, setC] = useState(() => inicial(amenity));
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof c>(k: K, v: (typeof c)[K]) => setC((p) => ({ ...p, [k]: v }));
  const numero = (v: string) => (v.trim() === '' ? undefined : Number(v));

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await onGuardar({
        nombre: c.nombre.trim(),
        icono: c.icono,
        cupoPersonas: numero(c.cupoPersonas),
        lugares: Number(c.lugares),
        horaApertura: c.horaApertura,
        horaCierre: c.horaCierre,
        duracionFranjaMinutos: c.franja === 'libre' ? null : Number(c.franja),
        duracionMaximaHoras: numero(c.duracionMaximaHoras),
        anticipacionMinimaHoras: Number(c.anticipacionMinimaHoras),
        cancelacionMinimaHoras: Number(c.cancelacionMinimaHoras),
        montoSena: Number(c.montoSena),
        diasDevolucionSena: Number(c.diasDevolucionSena),
        requiereAprobacion: c.requiereAprobacion,
        bloqueaConDeuda: c.bloqueaConDeuda,
        reglamento: c.reglamento.trim() || null,
        ...(amenity ? { activo: c.activo } : {}),
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el amenity.');
      setEnviando(false);
    }
  }

  const campoNumero = (id: keyof typeof c, etiqueta: string, ayuda?: string, extra: object = {}) => (
    <Field>
      <FieldLabel htmlFor={id}>{etiqueta}</FieldLabel>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        value={c[id] as string}
        onChange={(e) => set(id, e.target.value as never)}
        {...extra}
      />
      {ayuda && <FieldDescription>{ayuda}</FieldDescription>}
    </Field>
  );

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="nombre">Nombre</FieldLabel>
          <Input
            id="nombre"
            required
            maxLength={80}
            value={c.nombre}
            onChange={(e) => set('nombre', e.target.value)}
            placeholder="SUM"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="icono">Ícono</FieldLabel>
          <Select value={c.icono} onValueChange={(v) => set('icono', v)}>
            <SelectTrigger id="icono" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ICONOS_AMENITY.map((i) => (
                <SelectItem key={i.valor} value={i.valor}>
                  <i.icono />
                  {i.etiqueta}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="horaApertura">Abre</FieldLabel>
          <Input
            id="horaApertura"
            type="time"
            required
            value={c.horaApertura}
            onChange={(e) => set('horaApertura', e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="horaCierre">Cierra</FieldLabel>
          <Input
            id="horaCierre"
            type="time"
            required
            value={c.horaCierre}
            onChange={(e) => set('horaCierre', e.target.value)}
          />
          <FieldDescription>Si cierra antes de abrir, es de madrugada: 10:00 a 02:00.</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="franja">Cómo se reserva</FieldLabel>
          <Select value={c.franja} onValueChange={(v) => set('franja', v)}>
            <SelectTrigger id="franja" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FRANJAS.map((f) => (
                <SelectItem key={f.valor} value={f.valor}>
                  {f.etiqueta}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {campoNumero('duracionMaximaHoras', 'Duración máxima (horas)', 'Vacío: sin límite.', { min: 1, max: 24 })}

        {campoNumero('cupoPersonas', 'Cupo de personas', 'Vacío: sin cupo.', { min: 1 })}
        {campoNumero('lugares', 'Lugares', 'Reservas a la vez: la cochera de visitas tiene 2.', { min: 1, max: 50, required: true })}

        {campoNumero('anticipacionMinimaHoras', 'Anticipación mínima (horas)', undefined, { max: 720 })}
        {campoNumero('cancelacionMinimaHoras', 'Cancela hasta (horas antes)', '0: hasta que empieza.', { max: 720 })}

        {campoNumero('montoSena', 'Seña ($)', '0: sin seña.', { step: '0.01' })}
        {campoNumero('diasDevolucionSena', 'Devolución de la seña (días)', undefined, { max: 365 })}

        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="reglamento">Reglamento</FieldLabel>
          <Textarea
            id="reglamento"
            rows={3}
            maxLength={4000}
            value={c.reglamento}
            onChange={(e) => set('reglamento', e.target.value)}
            placeholder="Música hasta las 01:00 y devolución del SUM limpio."
          />
          <FieldDescription>Una regla por línea: el vecino las lee antes de confirmar.</FieldDescription>
        </Field>

        <Interruptor id="requiereAprobacion" valor={c.requiereAprobacion} onChange={(v) => set('requiereAprobacion', v)}>
          Las reservas esperan tu aprobación
        </Interruptor>
        <Interruptor id="bloqueaConDeuda" valor={c.bloqueaConDeuda} onChange={(v) => set('bloqueaConDeuda', v)}>
          No se reserva con expensas vencidas
        </Interruptor>
        {amenity && (
          <Interruptor id="activo" valor={c.activo} onChange={(v) => set('activo', v)}>
            Habilitado para reservar
          </Interruptor>
        )}
      </FieldGroup>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <DialogFooter className="sm:items-center">
        <p className="text-xs text-muted-foreground sm:mr-auto">
          {amenity ? 'Las reservas ya hechas no cambian.' : 'Los vecinos lo ven al guardarlo.'}
        </p>
        <Button type="button" variant="outline" onClick={onCancelar} disabled={enviando}>
          Cancelar
        </Button>
        <Button type="submit" disabled={enviando}>
          {enviando ? 'Guardando…' : amenity ? 'Guardar cambios' : 'Crear amenity'}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Un switch en su caja gris, como en el modal 08. */
function Interruptor({
  id,
  valor,
  onChange,
  children,
}: {
  id: string;
  valor: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Field orientation="horizontal" className="rounded-lg bg-muted px-3 py-2.5">
      <Switch id={id} checked={valor} onCheckedChange={onChange} />
      <FieldLabel htmlFor={id} className="font-normal text-secondary-foreground">
        {children}
      </FieldLabel>
    </Field>
  );
}
