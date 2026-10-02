export interface VentanaAmenity {
  horaApertura: string;
  horaCierre: string;
  duracionMaximaHoras: number | null;
}

export type ProblemaFranja =
  | 'FIN_ANTES_DE_INICIO'
  | 'FUERA_DE_HORARIO'
  | 'DEMASIADO_LARGA';

export const ZONA_POR_DEFECTO = 'America/Argentina/Buenos_Aires';

export function minutosDeHora(hora: string): number {
  const [h, m] = hora.split(':');
  return Number(h) * 60 + Number(m);
}

export function validarFranja(
  horaInicio: string,
  horaFin: string,
  ventana: VentanaAmenity,
): ProblemaFranja | null {
  const inicio = minutosDeHora(horaInicio);
  const fin = minutosDeHora(horaFin);

  if (fin <= inicio) return 'FIN_ANTES_DE_INICIO';

  if (
    inicio < minutosDeHora(ventana.horaApertura) ||
    fin > minutosDeHora(ventana.horaCierre)
  ) {
    return 'FUERA_DE_HORARIO';
  }

  if (
    ventana.duracionMaximaHoras !== null &&
    fin - inicio > ventana.duracionMaximaHoras * 60
  ) {
    return 'DEMASIADO_LARGA';
  }

  return null;
}
