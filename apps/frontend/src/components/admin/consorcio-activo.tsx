'use client';

import { Building2 } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { EsqueletoPanel, useSesion } from '@/components/session';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { consorciosService } from '@/services/consorcios';
import type { Consorcio } from '@/types/consorcio';

interface ConsorcioActivo {
  /** Todos los consorcios que administra (el superadmin, todos). */
  consorcios: Consorcio[];
  /** El elegido en el selector: todas las pantallas del admin filtran por este. */
  consorcio: Consorcio;
  cambiar: (id: string) => void;
}

const ConsorcioActivoContext = createContext<ConsorcioActivo | null>(null);

/**
 * El consorcio sobre el que se está trabajando. Las pantallas lo leen así:
 *
 *   const { consorcio } = useConsorcioActivo();
 *   reclamosService.listar({ consorcioId: consorcio.id });
 *
 * y cuando el administrador cambia de edificio en el selector, se vuelven a
 * pedir solas si `consorcio.id` está en las dependencias del efecto.
 */
export function useConsorcioActivo(): ConsorcioActivo {
  const valor = useContext(ConsorcioActivoContext);
  if (!valor) throw new Error('useConsorcioActivo solo funciona adentro del portal del administrador');
  return valor;
}

/** Dónde se recuerda el último consorcio elegido, para que al volver siga en el mismo. */
const CLAVE = 'domus.consorcioActivo';

function leerGuardado(): string | null {
  try {
    return localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}

export function ConsorcioActivoProvider({ children }: { children: React.ReactNode }) {
  const { cerrarSesion } = useSesion();
  const [consorcios, setConsorcios] = useState<Consorcio[] | null>(null);
  const [id, setId] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    consorciosService
      .list()
      .then((lista) => {
        const activos = lista.filter((c) => c.activo);
        setConsorcios(activos);
        const guardado = leerGuardado();
        // El guardado puede ser de un consorcio que ya no administra.
        setId(activos.some((c) => c.id === guardado) ? guardado : (activos[0]?.id ?? null));
      })
      .catch(() => setError(true));
  }, []);

  const cambiar = useCallback((nuevo: string) => {
    setId(nuevo);
    try {
      localStorage.setItem(CLAVE, nuevo);
    } catch {
      /* sin storage (modo privado): se recuerda sólo mientras dure la pestaña */
    }
  }, []);

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertDescription>No se pudieron cargar tus consorcios. Recargá la página.</AlertDescription>
        </Alert>
      </div>
    );
  }
  if (!consorcios) return <EsqueletoPanel />;

  const consorcio = consorcios.find((c) => c.id === id);
  if (!consorcio) {
    return (
      <div className="mx-auto max-w-md p-6">
        <EmptyState
          icono={Building2}
          titulo="Todavía no tenés consorcios"
          descripcion="Cuando el administrador de la plataforma te asigne un edificio, lo vas a ver acá."
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
    <ConsorcioActivoContext.Provider value={{ consorcios, consorcio, cambiar }}>
      {children}
    </ConsorcioActivoContext.Provider>
  );
}
