'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api';

interface Respuesta<T> {
  clave: string;
  version: number;
  datos?: T;
  error?: string;
}

export interface Pedido<T> {
  /** Lo último que llegó para esta clave. Durante un `recargar()` se sigue mostrando lo anterior. */
  datos: T | undefined;
  error: string | undefined;
  /**
   * Lo último que llegó, sea de la clave que sea. Para "Ver más": al pedir
   * una página más larga se sigue mostrando la lista anterior.
   */
  ultimo: T | undefined;
  /** Hay un pedido en vuelo para la clave actual (la primera vez, o tras `recargar()`). */
  cargando: boolean;
  /** Vuelve a pedir sin vaciar la pantalla: para después de guardar algo. */
  recargar: () => void;
}

/**
 * Pide datos al backend y los vuelve a pedir cuando cambia `clave` (el
 * consorcio activo, los filtros). Con `clave` en `null` no pide nada.
 *
 *   const { datos, cargando } = usePedido(`reclamos:${consorcio.id}:${estado}`, () =>
 *     reclamosService.listar({ consorcioId: consorcio.id, estado }),
 *   );
 *
 * Cada respuesta se guarda junto con la clave que la pidió: así una respuesta
 * vieja que llega tarde no pisa la de los filtros nuevos, y no hace falta
 * marcar "cargando" con un setState dentro del efecto.
 */
export function usePedido<T>(
  clave: string | null,
  pedir: () => Promise<T>,
  mensajeDeError = 'No se pudieron cargar los datos.',
): Pedido<T> {
  const [respuesta, setRespuesta] = useState<Respuesta<T> | null>(null);
  const [version, setVersion] = useState(0);

  // La función cambia en cada render; el pedido depende de la clave, no de ella.
  const pedirRef = useRef(pedir);
  useEffect(() => {
    pedirRef.current = pedir;
  });

  useEffect(() => {
    if (clave === null) return;
    let cancelado = false;
    pedirRef
      .current()
      .then((datos) => {
        if (!cancelado) setRespuesta({ clave, version, datos });
      })
      .catch((err: unknown) => {
        if (cancelado) return;
        const error = err instanceof ApiError ? err.message : mensajeDeError;
        setRespuesta({ clave, version, error });
      });
    return () => {
      cancelado = true;
    };
  }, [clave, version, mensajeDeError]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  const deEstaClave = respuesta !== null && respuesta.clave === clave;
  return {
    datos: deEstaClave ? respuesta.datos : undefined,
    error: deEstaClave ? respuesta.error : undefined,
    ultimo: respuesta?.datos,
    cargando: clave !== null && (!deEstaClave || respuesta.version !== version),
    recargar,
  };
}
