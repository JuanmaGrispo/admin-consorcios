'use client';

import { Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { IconoCatalogo } from '@/components/catalogos/icono-catalogo';
import { PageHeader } from '@/components/page-header';
import { MAXIMO_FOTOS, SelectorFotos, type FotoSubida } from '@/components/reclamos/selector-fotos';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useUnidadActiva } from '@/components/vecino/unidad-activa';
import { usePedido } from '@/hooks/use-pedido';
import { ApiError } from '@/lib/api';
import { categoriasReclamoService } from '@/services/categorias-reclamo';
import { reclamosService } from '@/services/reclamos';

/** El backend pide al menos 10 caracteres: "no anda" no le alcanza a nadie para actuar. */
const MINIMO_DESCRIPCION = 10;

/** Pantalla 13b del prototipo: categoría, descripción y hasta 5 fotos. */
export default function VecinoReclamosNuevoPage() {
  const router = useRouter();
  const { unidad, consorcio } = useUnidadActiva();
  const categorias = usePedido(
    `categorias:${consorcio.id}`,
    () => categoriasReclamoService.listar(consorcio.id),
    'No se pudieron cargar las categorías.',
  );

  const [categoriaId, setCategoriaId] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fotos, setFotos] = useState<FotoSubida[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [errorFotos, setErrorFotos] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!categoriaId) {
      setError('Elegí una categoría: así le llega a quien corresponde.');
      return;
    }
    if (descripcion.trim().length < MINIMO_DESCRIPCION) {
      setError('Contá un poco más: al menos 10 caracteres.');
      return;
    }

    setEnviando(true);
    try {
      const creado = await reclamosService.crear({
        categoriaId,
        descripcion: descripcion.trim(),
        // Siempre la unidad elegida arriba: con más de una, el backend no puede adivinarla.
        unidadId: unidad.id,
        adjuntos: fotos.map((f) => ({ url: f.url, nombre: f.nombre })),
      });
      router.replace(`/vecino/reclamos/${creado.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo enviar el reclamo.');
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader titulo="Nuevo reclamo" contexto={`Unidad ${unidad.etiqueta}`} volverA="/vecino/reclamos" />

      <form onSubmit={enviar} className="flex flex-col gap-5">
        <FieldGroup>
          <Field>
            <FieldLabel id="categoria-label">Categoría</FieldLabel>
            {categorias.error && (
              <Alert variant="destructive">
                <AlertDescription>{categorias.error}</AlertDescription>
              </Alert>
            )}
            {!categorias.datos && !categorias.error && (
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-11 rounded-lg" />
                ))}
              </div>
            )}
            {categorias.datos && (
              <ToggleGroup
                type="single"
                variant="outline"
                aria-labelledby="categoria-label"
                value={categoriaId}
                onValueChange={(v) => v && setCategoriaId(v)}
                className="grid w-full grid-cols-2"
              >
                {categorias.datos.map((c) => (
                  <ToggleGroupItem
                    key={c.id}
                    value={c.id}
                    className="h-11 min-w-0 justify-start gap-2 bg-card px-3 data-[state=on]:border-primary data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
                  >
                    <IconoCatalogo nombre={c.icono} className="size-5" />
                    <span className="truncate">{c.nombre}</span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}
            {categorias.datos?.length === 0 && (
              <FieldDescription>
                La administración todavía no cargó categorías de reclamo. Avisale para que lo haga.
              </FieldDescription>
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="descripcion">Descripción</FieldLabel>
            <Textarea
              id="descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={5}
              maxLength={2000}
              className="bg-card"
              placeholder="Hay una pérdida en la canilla del baño desde el domingo. El agua filtra al techo del 2º B."
            />
            <FieldDescription>Contanos qué pasa, desde cuándo y si afecta a otras unidades.</FieldDescription>
          </Field>

          <Field>
            <FieldLabel>
              Fotos · {fotos.length} de {MAXIMO_FOTOS}
            </FieldLabel>
            <SelectorFotos fotos={fotos} onChange={setFotos} onError={setErrorFotos} onSubiendo={setSubiendo} />
            {errorFotos && <p className="text-sm text-destructive">{errorFotos}</p>}
          </Field>
        </FieldGroup>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={enviando || subiendo}>
          <Send />
          {enviando ? 'Enviando…' : subiendo ? 'Subiendo fotos…' : 'Enviar reclamo'}
        </Button>
      </form>
    </div>
  );
}
