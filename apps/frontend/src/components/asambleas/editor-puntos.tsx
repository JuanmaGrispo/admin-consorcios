'use client';

import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TipoPuntoOrden } from '@/types/asamblea';

/** Un punto en edición: el texto sigue como string hasta que se guarda. */
export interface PuntoEditable {
  titulo: string;
  descripcion: string;
  tipo: TipoPuntoOrden;
}

export const PUNTO_VACIO: PuntoEditable = { titulo: '', descripcion: '', tipo: 'INFORMATIVO' };

const MAX_PUNTOS = 50;

interface EditorPuntosProps {
  puntos: PuntoEditable[];
  onCambiar: (puntos: PuntoEditable[]) => void;
}

/** El orden del día como lista editable: el número de cada punto lo da su posición. */
export function EditorPuntos({ puntos, onCambiar }: EditorPuntosProps) {
  const cambiar = (i: number, parcial: Partial<PuntoEditable>) =>
    onCambiar(puntos.map((p, j) => (j === i ? { ...p, ...parcial } : p)));

  function mover(i: number, delta: -1 | 1) {
    const copia = [...puntos];
    [copia[i], copia[i + delta]] = [copia[i + delta], copia[i]];
    onCambiar(copia);
  }

  return (
    <div className="flex flex-col gap-3">
      {puntos.map((p, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-lg border p-3">
          <div className="flex items-center gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground tabular-nums">
              {i + 1}
            </span>
            <Input
              required
              maxLength={150}
              aria-label={`Título del punto ${i + 1}`}
              value={p.titulo}
              onChange={(e) => cambiar(i, { titulo: e.target.value })}
              placeholder="Cambio de la bomba de agua"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Subir punto"
              disabled={i === 0}
              onClick={() => mover(i, -1)}
            >
              <ArrowUp />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Bajar punto"
              disabled={i === puntos.length - 1}
              onClick={() => mover(i, 1)}
            >
              <ArrowDown />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Quitar punto"
              onClick={() => onCambiar(puntos.filter((_, j) => j !== i))}
            >
              <X />
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_11rem]">
            <Input
              maxLength={2000}
              aria-label={`Detalle del punto ${i + 1}`}
              value={p.descripcion}
              onChange={(e) => cambiar(i, { descripcion: e.target.value })}
              placeholder="Detalle (opcional)"
            />
            <Select value={p.tipo} onValueChange={(t) => cambiar(i, { tipo: t as TipoPuntoOrden })}>
              <SelectTrigger className="w-full" aria-label={`Tipo del punto ${i + 1}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INFORMATIVO">Informativo</SelectItem>
                <SelectItem value="CON_VOTACION">Con votación</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ))}
      {puntos.length < MAX_PUNTOS && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => onCambiar([...puntos, PUNTO_VACIO])}
        >
          <Plus data-icon="inline-start" />
          Sumar punto
        </Button>
      )}
    </div>
  );
}

/** Lo que espera el backend: sin descripción vacía. */
export function puntosParaEnviar(puntos: PuntoEditable[]) {
  return puntos.map((p) => ({
    titulo: p.titulo.trim(),
    descripcion: p.descripcion.trim() || undefined,
    tipo: p.tipo,
  }));
}
