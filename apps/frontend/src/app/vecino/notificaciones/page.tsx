import { CentroNotificaciones } from '@/components/notificaciones/centro-notificaciones';

export default function VecinoNotificacionesPage() {
  return (
    <CentroNotificaciones
      portal="vecino"
      volverA="/vecino"
      descripcionVacia="Acá te llegan las boletas, los cambios en tus reclamos y reservas, y las asambleas."
    />
  );
}
