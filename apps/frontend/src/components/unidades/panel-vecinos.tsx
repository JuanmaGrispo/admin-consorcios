'use client';

import { Star, UserMinus, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmarAccion } from '@/components/confirmar-accion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { usePedido } from '@/hooks/use-pedido';
import { fecha } from '@/lib/formato';
import { unidadesService } from '@/services/unidades';
import type { Unidad, Vinculo, VinculoInput } from '@/types/unidad';
import { DialogoVincular } from './dialogo-vincular';
import { VINCULOS } from './etiquetas';

interface PanelVecinosProps {
  unidad: Unidad | null;
  onCerrar: () => void;
  /** Después de vincular o desvincular: la tabla muestra cuántos vecinos tiene. */
  onCambio: () => void;
}

/** Quién vive en la unidad, en un panel lateral: sumar vecinos y terminar vínculos. */
export function PanelVecinos({ unidad, onCerrar, onCambio }: PanelVecinosProps) {
  return (
    <Sheet open={unidad !== null} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        {/* Se monta con la unidad elegida: cada una carga de cero. */}
        {unidad && <Contenido key={unidad.id} unidad={unidad} onCambio={onCambio} />}
      </SheetContent>
    </Sheet>
  );
}

function Contenido({ unidad, onCambio }: { unidad: Unidad; onCambio: () => void }) {
  const [historial, setHistorial] = useState(false);
  const [vinculando, setVinculando] = useState(false);
  const [aTerminar, setATerminar] = useState<Vinculo | null>(null);

  const pedido = usePedido(
    `vinculos:${unidad.id}:${historial}`,
    () => unidadesService.listarVinculos(unidad.id, historial),
    'No se pudieron cargar los vecinos de la unidad.',
  );
  const vinculos = pedido.datos ?? pedido.ultimo;
  const vigentes = vinculos?.filter((v) => !v.hasta) ?? [];

  async function vincular(input: VinculoInput) {
    await unidadesService.vincular(unidad.id, input);
    toast.success('Vecino vinculado');
    setVinculando(false);
    pedido.recargar();
    onCambio();
  }

  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle>Vecinos de {unidad.etiqueta}</SheetTitle>
        <SheetDescription>Propietarios e inquilinos. Los vínculos terminados quedan en el historial.</SheetDescription>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <Field orientation="horizontal">
          <Switch id="historial" checked={historial} onCheckedChange={setHistorial} />
          <FieldLabel htmlFor="historial" className="font-normal text-secondary-foreground">
            Mostrar vínculos terminados
          </FieldLabel>
        </Field>

        {pedido.error ? (
          <Alert variant="destructive">
            <AlertDescription>{pedido.error}</AlertDescription>
          </Alert>
        ) : !vinculos ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : vinculos.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nadie vinculado todavía.</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {vinculos.map((v) => (
              <li key={v.id} className="flex items-start gap-3 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 font-medium">
                    {v.usuario.nombre} {v.usuario.apellido}
                    {v.esTitular && (
                      <Star className="size-3.5 fill-primary text-primary" aria-label="Titular" />
                    )}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{v.usuario.email}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <Badge variant="outline">{VINCULOS[v.vinculo]}</Badge>
                    <span className="tabular-nums">
                      Desde {fecha(v.desde)}
                      {v.hasta && ` · hasta ${fecha(v.hasta)}`}
                    </span>
                  </p>
                </div>
                {!v.hasta && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Terminar el vínculo de ${v.usuario.nombre}`}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setATerminar(v)}
                  >
                    <UserMinus />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <SheetFooter className="border-t">
        <Button onClick={() => setVinculando(true)} disabled={!unidad.activa}>
          <UserPlus data-icon="inline-start" />
          Sumar vecino
        </Button>
        {!unidad.activa && (
          <p className="text-center text-xs text-muted-foreground">
            La unidad está dada de baja: reactivala para sumar vecinos.
          </p>
        )}
      </SheetFooter>

      {vinculando && (
        <DialogoVincular
          unidad={unidad}
          hayTitular={vigentes.some((v) => v.esTitular)}
          onVincular={vincular}
          onCerrar={() => setVinculando(false)}
        />
      )}

      <ConfirmarAccion
        abierto={aTerminar !== null}
        titulo={`¿Terminar el vínculo de ${aTerminar?.usuario.nombre ?? ''} ${aTerminar?.usuario.apellido ?? ''}?`}
        descripcion="Deja de ver la unidad desde hoy. El vínculo queda en el historial; si todavía no había empezado, se borra."
        boton="Terminar vínculo"
        onConfirmar={async () => {
          if (!aTerminar) return;
          await unidadesService.desvincular(unidad.id, aTerminar.id);
          toast.success('Vínculo terminado');
          pedido.recargar();
          onCambio();
        }}
        onCerrar={() => setATerminar(null)}
      />
    </>
  );
}
