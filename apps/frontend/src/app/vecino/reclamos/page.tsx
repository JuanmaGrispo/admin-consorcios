import { EnConstruccion } from '@/components/en-construccion';

/** Módulo Reclamos y novedades: quien lo toma reemplaza esta página entera. */
export default function VecinoReclamosPage() {
  return (
    <EnConstruccion
      titulo="Mis reclamos"
      pantalla="13 Mis reclamos"
      modulo="Reclamos y novedades"
      volverA="/vecino"
    />
  );
}
