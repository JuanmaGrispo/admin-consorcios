import { EnConstruccion } from '@/components/en-construccion';

/** Módulo Reclamos y novedades: quien lo toma reemplaza esta página entera. */
export default function VecinoNovedadesPage() {
  return (
    <EnConstruccion
      titulo="Novedades"
      pantalla="16 Novedades del edificio"
      modulo="Reclamos y novedades"
      volverA="/vecino"
    />
  );
}
