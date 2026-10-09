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
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { usePedido } from '@/hooks/use-pedido';
import { ApiError } from '@/lib/api';
import { archivosService } from '@/services/archivos';
import { reclamosService } from '@/services/reclamos';
import { unidadesService } from '@/services/unidades';
import type { CategoriaReclamo } from '@/types/catalogo';
import type { PrioridadReclamo, Reclamo } from '@/types/reclamo';
import { MAXIMO_FOTOS, SelectorFotos, type FotoSubida } from './selector-fotos';

interface DialogoNuevoReclamoProps {
  consorcioId: string;
  categorias: CategoriaReclamo[];
  abierto: boolean;
  onAbiertoChange: (abierto: boolean) => void;
  onCreado: (reclamo: Reclamo) => void;
}

/**
 * El administrador también abre reclamos (un aviso por teléfono, algo que vio
 * en una recorrida). A diferencia del vecino, indica la unidad y la prioridad.
 */
export function DialogoNuevoReclamo({
  consorcioId,
  categorias,
  abierto,
  onAbiertoChange,
  onCreado,
}: DialogoNuevoReclamoProps) {
  const unidades = usePedido(
    abierto ? `unidades:${consorcioId}` : null,
    () => unidadesService.listar({ consorcioId }),
    'No se pudieron cargar las unidades.',
  );
  const [unidadId, setUnidadId] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [prioridad, setPrioridad] = useState<PrioridadReclamo>('MEDIA');
  const [descripcion, setDescripcion] = useState('');
  const [fotos, setFotos] = useState<FotoSubida[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  function limpiar() {
    setUnidadId('');
    setCategoriaId('');
    setPrioridad('MEDIA');
    setDescripcion('');
    setFotos([]);
    setError(null);
  }

  function cambiarAbierto(valor: boolean) {
    if (!valor) {
      // Las fotos subidas de un reclamo que no se crea no tienen que quedar en el storage.
      for (const foto of fotos) archivosService.borrar(foto.url).catch(() => undefined);
      limpiar();
    }
    onAbiertoChange(valor);
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!unidadId || !categoriaId) {
      setError('Elegí la unidad y la categoría.');
      return;
    }
    if (descripcion.trim().length < 10) {
      setError('La descripción necesita al menos 10 caracteres.');
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const creado = await reclamosService.crear({
        unidadId,
        categoriaId,
        prioridad,
        descripcion: descripcion.trim(),
        adjuntos: fotos.map((f) => ({ url: f.url, nombre: f.nombre })),
      });
      limpiar();
      onAbiertoChange(false);
      onCreado(creado);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el reclamo.');
    } finally {
      setGuardando(false);
    }
  }

  const activas = unidades.datos?.filter((u) => u.activa) ?? [];

  return (
    <Dialog open={abierto} onOpenChange={cambiarAbierto}>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <form onSubmit={crear} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Nuevo reclamo</DialogTitle>
            <DialogDescription>Queda a nombre de la unidad y el vecino lo ve en su app.</DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="nuevo-unidad">Unidad</FieldLabel>
                <Select value={unidadId} onValueChange={setUnidadId} disabled={!unidades.datos}>
                  <SelectTrigger id="nuevo-unidad" className="w-full">
                    <SelectValue placeholder={unidades.datos ? 'Elegí la unidad' : 'Cargando unidades…'} />
                  </SelectTrigger>
                  <SelectContent>
                    {activas.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.etiqueta}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="nuevo-prioridad">Prioridad</FieldLabel>
                <Select value={prioridad} onValueChange={(v) => setPrioridad(v as PrioridadReclamo)}>
                  <SelectTrigger id="nuevo-prioridad" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALTA">Alta</SelectItem>
                    <SelectItem value="MEDIA">Media</SelectItem>
                    <SelectItem value="BAJA">Baja</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="nuevo-categoria">Categoría</FieldLabel>
              <Select value={categoriaId} onValueChange={setCategoriaId}>
                <SelectTrigger id="nuevo-categoria" className="w-full">
                  <SelectValue placeholder="Elegí la categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="nuevo-descripcion">Descripción</FieldLabel>
              <Textarea
                id="nuevo-descripcion"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Qué pasa, desde cuándo y si afecta a otras unidades."
              />
            </Field>
            <Field>
              <FieldLabel>
                Fotos · {fotos.length} de {MAXIMO_FOTOS}
              </FieldLabel>
              <SelectorFotos fotos={fotos} onChange={setFotos} onError={setError} onSubiendo={setSubiendo} />
            </Field>
          </FieldGroup>

          {(error || unidades.error) && (
            <Alert variant="destructive">
              <AlertDescription>{error ?? unidades.error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => cambiarAbierto(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando || subiendo}>
              {guardando ? 'Creando…' : 'Crear reclamo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
