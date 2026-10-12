'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { notificacionesService } from '@/services/notificaciones';

/** Los avisos sin leer. Se vuelven a pedir al cambiar de pantalla, que es cuando se puede haber leído alguno. */
export function useNoLeidas(): number {
  const pathname = usePathname();
  const [noLeidas, setNoLeidas] = useState(0);

  useEffect(() => {
    let cancelado = false;
    notificacionesService
      .noLeidas()
      .then((n) => !cancelado && setNoLeidas(n))
      .catch(() => undefined);
    return () => {
      cancelado = true;
    };
  }, [pathname]);

  return noLeidas;
}
