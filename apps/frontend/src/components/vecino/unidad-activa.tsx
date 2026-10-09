'use client';

import { Home } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { useSesion } from '@/components/session';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { consorciosService } from '@/services/consorcios';
import { unidadesService } from '@/services/unidades';
import type { Consorcio } from '@/types/consorcio';
import type { Unidad } from '@/types/unidad';
import { EsqueletoVecino } from './esqueleto-vecino';

interface UnidadActiva {
  /** Todas sus unidades: un vecino puede tener un departamento y una cochera. */
  unidades: Unidad[];
  /** La que eligió arriba: expensas, reclamos y reservas son de esta. */
  unidad: Unidad;
  /** El edificio de esa unidad. */
  consorcio: Consorcio;
  cambiar: (id: string) => void;
}

const UnidadActivaContext = createContext<UnidadActiva | null>(null);

/**
 * La unidad sobre la que está mirando el vecino. Las pantallas la usan así:
 *
 *   const { unidad } = useUnidadActiva();
 *   expensasService.listarBoletas({ unidadId: unidad.id });
 *
 * Con una sola unidad no hay nada que elegir; con varias, el selector de la
 * barra de arriba la cambia y las pantallas se vuelven a pedir solas si
 * `unidad.id` está en las dependencias del efecto.
 */
export function useUnidadActiva(): UnidadActiva {
  const valor = useContext(UnidadActivaContext);
  if (!valor) throw new Error('useUnidadActiva solo funciona adentro del portal del vecino');
  return valor;
}

const CLAVE = 'domus.unidadActiva';

function leerGuardada(): string | null {
  try {
    return localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}

export function UnidadActivaProvider({ children }: { children: React.ReactNode }) {
  const { cerrarSesion } = useSesion();
  const [datos, setDatos] = useState<{ unidades: Unidad[]; consorcios: Consorcio[] } | null>(null);
  const [id, setId] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([unidadesService.listar(), consorciosService.list()])
      .then(([unidades, consorcios]) => {
        setDatos({ unidades, consorcios });
        const guardada = leerGuardada();
        setId(unidades.some((u) => u.id === guardada) ? guardada : (unidades[0]?.id ?? null));
      })
      .catch(() => setError(true));
  }, []);

  const cambiar = useCallback((nueva: string) => {
    setId(nueva);
    try {
      localStorage.setItem(CLAVE, nueva);
    } catch {
      /* sin storage: se recuerda sólo mientras dure la pestaña */
    }
  }, []);

  if (error) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertDescription>No se pudieron cargar tus unidades. Recargá la página.</AlertDescription>
        </Alert>
      </div>
    );
  }
  if (!datos) return <EsqueletoVecino />;

  const unidad = datos.unidades.find((u) => u.id === id);
  const consorcio = unidad && datos.consorcios.find((c) => c.id === unidad.consorcioId);
  if (!unidad || !consorcio) {
    return (
      <div className="mx-auto max-w-md p-4">
        <EmptyState
          icono={Home}
          titulo="Todavía no tenés una unidad"
          descripcion="Cuando la administración te vincule a tu departamento, vas a ver acá tus expensas, reclamos y reservas."
          accion={
            <Button variant="outline" onClick={cerrarSesion}>
              Cerrar sesión
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <UnidadActivaContext.Provider value={{ unidades: datos.unidades, unidad, consorcio, cambiar }}>
      {children}
    </UnidadActivaContext.Provider>
  );
}
