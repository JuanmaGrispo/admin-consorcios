import { EnConstruccion } from '@/components/en-construccion';

/** Módulo Expensas y pagos: quien lo toma reemplaza esta página entera. */
export default function VecinoExpensasPage() {
  return (
    <EnConstruccion
      titulo="Mis expensas"
      pantalla="11 Mis expensas"
      modulo="Expensas y pagos"
      volverA="/vecino"
    />
  );
}
