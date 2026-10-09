import { EnConstruccion } from '@/components/en-construccion';

/** Módulo Expensas y pagos: quien lo toma reemplaza esta página entera. */
export default function VecinoExpensasDetallePage() {
  return (
    <EnConstruccion
      titulo="Detalle de la boleta"
      pantalla="11 Mis expensas · detalle por rubro"
      modulo="Expensas y pagos"
      volverA="/vecino/expensas"
    />
  );
}
