import { EnConstruccion } from '@/components/en-construccion';

/** Módulo Reservas: quien lo toma reemplaza esta página entera. */
export default function VecinoReservasPage() {
  return (
    <EnConstruccion
      titulo="Reservar"
      pantalla="14 Reservar amenity y mis reservas"
      modulo="Reservas"
      volverA="/vecino"
    />
  );
}
