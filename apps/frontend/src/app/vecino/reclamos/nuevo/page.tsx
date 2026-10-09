import { EnConstruccion } from '@/components/en-construccion';

/** Módulo Reclamos y novedades: quien lo toma reemplaza esta página entera. */
export default function VecinoReclamosNuevoPage() {
  return (
    <EnConstruccion
      titulo="Nuevo reclamo"
      pantalla="13 Mis reclamos · alta con fotos"
      modulo="Reclamos y novedades"
      volverA="/vecino/reclamos"
    />
  );
}
