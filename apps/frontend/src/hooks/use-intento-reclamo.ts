'use client';
import { useRef } from 'react';
import { ApiError } from '@/lib/api';
import { reclamosService } from '@/services/reclamos';
import type { CrearReclamoInput } from '@/types/reclamo';

/** Un reintento conserva intención y cuerpo, aunque se haya perdido la respuesta. */
export function useIntentoReclamo() {
  const intento = useRef<{ clave: string; contenido: string } | null>(null);
  return {
    reiniciar: () => { intento.current = null; },
    pendiente: () => intento.current !== null,
    crear: (input: CrearReclamoInput) => {
      const contenido = JSON.stringify(input);
      intento.current ??= { clave: crypto.randomUUID(), contenido };
      if (intento.current.contenido !== contenido) {
        throw new ApiError(409, 'Hay un envío pendiente. Reintentá con los datos originales o revisá la lista de reclamos antes de iniciar otro.');
      }
      return reclamosService.crear(input, intento.current.clave);
    },
  };
}
