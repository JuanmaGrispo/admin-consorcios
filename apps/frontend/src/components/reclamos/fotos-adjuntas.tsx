import type { ReclamoAdjunto } from '@/types/reclamo';

/**
 * Las fotos del reclamo en miniatura. Cada una abre el original en otra
 * pestaña: en el celular es la forma más simple de hacer zoom.
 */
export function FotosAdjuntas({ adjuntos }: { adjuntos: ReclamoAdjunto[] }) {
  if (adjuntos.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {adjuntos.map((foto, i) => (
        <a
          key={foto.id}
          href={foto.url}
          target="_blank"
          rel="noreferrer"
          className="block size-20 overflow-hidden rounded-lg border bg-muted transition-opacity hover:opacity-80"
          title={foto.nombre ?? `Foto ${i + 1}`}
        >
          {/* Fotos de Supabase Storage: next/image necesitaría declarar el dominio y no gana nada en miniaturas. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={foto.url}
            alt={foto.nombre ?? `Foto ${i + 1} del reclamo`}
            className="size-full object-cover"
            loading="lazy"
          />
        </a>
      ))}
    </div>
  );
}
