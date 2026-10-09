import { EnConstruccion } from '@/components/en-construccion';

/** Módulo Panel, inicio y perfil: quien lo toma reemplaza esta página entera. */
export default function VecinoPerfilPage() {
  return (
    <EnConstruccion
      titulo="Perfil"
      pantalla="16 Perfil y preferencias de aviso"
      modulo="Panel, inicio y perfil"
      volverA="/vecino"
    />
  );
}
