'use client';

import { ImagePlus, Loader2, X } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ApiError, subirArchivo } from '@/lib/api';
import { archivosService } from '@/services/archivos';

/** La base admite hasta 5 fotos por reclamo; el prototipo muestra "Fotos · 2 de 5". */
export const MAXIMO_FOTOS = 5;
const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];
const MAXIMO_MB = 8;

export interface FotoSubida {
  url: string;
  nombre: string;
}

interface SelectorFotosProps {
  fotos: FotoSubida[];
  onChange: (fotos: FotoSubida[]) => void;
  onError: (mensaje: string | null) => void;
  /** Mientras sube, el formulario no se tiene que poder enviar. */
  onSubiendo?: (subiendo: boolean) => void;
}

/**
 * Las fotos se suben apenas se eligen (`POST /archivos?destino=reclamos`) y el
 * alta del reclamo manda sólo las URLs. Si el vecino descarta una, se borra
 * del storage para no dejar basura.
 */
export function SelectorFotos({ fotos, onChange, onError, onSubiendo }: SelectorFotosProps) {
  const inputId = useId();
  const [subiendo, setSubiendo] = useState(0);

  async function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    const elegidas = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (elegidas.length === 0) return;
    onError(null);

    const lugar = MAXIMO_FOTOS - fotos.length;
    if (elegidas.length > lugar) {
      onError(`Podés adjuntar hasta ${MAXIMO_FOTOS} fotos.`);
    }
    const validas = elegidas.slice(0, lugar).filter((archivo) => {
      if (!TIPOS.includes(archivo.type)) {
        onError(`${archivo.name} no es una foto JPG, PNG o WEBP.`);
        return false;
      }
      if (archivo.size > MAXIMO_MB * 1024 * 1024) {
        onError(`${archivo.name} pesa más de ${MAXIMO_MB} MB.`);
        return false;
      }
      return true;
    });
    if (validas.length === 0) return;

    setSubiendo(validas.length);
    onSubiendo?.(true);
    const nuevas: FotoSubida[] = [];
    for (const archivo of validas) {
      try {
        const subida = await subirArchivo(archivo, 'reclamos');
        nuevas.push({ url: subida.url, nombre: archivo.name.slice(0, 120) });
      } catch (err) {
        onError(err instanceof ApiError ? err.message : `No se pudo subir ${archivo.name}.`);
      }
      setSubiendo((n) => n - 1);
    }
    onSubiendo?.(false);
    onChange([...fotos, ...nuevas]);
  }

  function quitar(foto: FotoSubida) {
    onChange(fotos.filter((f) => f.url !== foto.url));
    // Si falla el borrado no pasa nada visible: la foto ya no va en el reclamo.
    archivosService.borrar(foto.url).catch(() => undefined);
  }

  const lleno = fotos.length + subiendo >= MAXIMO_FOTOS;

  return (
    <div className="flex flex-wrap gap-2">
      {fotos.map((foto) => (
        <div key={foto.url} className="relative size-20 overflow-hidden rounded-lg border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={foto.url} alt={foto.nombre} className="size-full object-cover" />
          <Button
            type="button"
            variant="secondary"
            size="icon-xs"
            className="absolute top-1 right-1 rounded-full"
            onClick={() => quitar(foto)}
            aria-label={`Quitar ${foto.nombre}`}
          >
            <X />
          </Button>
        </div>
      ))}

      {Array.from({ length: subiendo }).map((_, i) => (
        <div
          key={`subiendo-${i}`}
          className="flex size-20 items-center justify-center rounded-lg border bg-muted text-muted-foreground"
        >
          <Loader2 className="size-5 animate-spin" aria-label="Subiendo foto" />
        </div>
      ))}

      {!lleno && (
        <label
          htmlFor={inputId}
          className="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-within:ring-2 focus-within:ring-ring"
        >
          <ImagePlus className="size-5" />
          <span className="text-[11px] font-medium">Agregar</span>
          <input
            id={inputId}
            type="file"
            accept={TIPOS.join(',')}
            multiple
            className="sr-only"
            onChange={elegir}
          />
        </label>
      )}
    </div>
  );
}
