import { EnConstruccion } from '@/components/en-construccion';

/** Módulo Asambleas y votaciones: quien lo toma reemplaza esta página entera. */
export default function VecinoAsambleasPage() {
  return (
    <EnConstruccion
      titulo="Asambleas y votaciones"
      pantalla="15 Asambleas y votaciones"
      modulo="Asambleas y votaciones"
      volverA="/vecino"
    />
  );
}
