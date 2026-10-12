import { CentroNotificaciones } from '@/components/notificaciones/centro-notificaciones';

export default function AdminNotificacionesPage() {
  return (
    <CentroNotificaciones
      portal="admin"
      volverA="/admin"
      descripcionVacia="Acá te llegan las reservas que esperan tu aprobación y los avisos de pagos que necesitan revisión."
    />
  );
}
