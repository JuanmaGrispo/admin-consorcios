import { EnConstruccion } from '@/components/en-construccion';

/** Módulo Reclamos y novedades: quien lo toma reemplaza esta página entera. */
export default function VecinoReclamosDetallePage() {
  return (
    <EnConstruccion
      titulo="Reclamo"
      pantalla="13 Mis reclamos · seguimiento"
      modulo="Reclamos y novedades"
      volverA="/vecino/reclamos"
    />
  );
}
