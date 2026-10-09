import { EnConstruccion } from '@/components/en-construccion';

/** Módulo Panel, inicio y perfil: quien lo toma reemplaza esta página entera. */
export default function VecinoNotificacionesPage() {
  return (
    <EnConstruccion
      titulo="Notificaciones"
      pantalla="16 Centro de notificaciones"
      modulo="Panel, inicio y perfil"
      volverA="/vecino"
    />
  );
}
