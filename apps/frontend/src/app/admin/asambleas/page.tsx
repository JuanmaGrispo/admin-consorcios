import { EnConstruccion } from '@/components/en-construccion';

/** Módulo Asambleas y votaciones: quien lo toma reemplaza esta página entera. */
export default function AdminAsambleasPage() {
  return (
    <EnConstruccion
      titulo="Asambleas"
      pantalla="06 Asambleas · listado y 07 Nueva asamblea"
      modulo="Asambleas y votaciones"
    />
  );
}
