export type PeriodicidadMora = 'DIARIA' | 'MENSUAL';

/** Espeja lo que devuelve el backend: la entidad + el admin recortado. */
export interface Consorcio {
  id: string;
  nombre: string;
  administradorId: string;
  administrador: {
    id: string;
    nombre: string;
    apellido: string;
    email: string;
  } | null;
  cantidadUnidades?: number;
  calle: string | null;
  numero: string | null;
  barrio: string | null;
  ciudad: string | null;
  provincia: string | null;
  cp: string | null;
  cuit: string | null;
  cbu: string | null;
  diaVencimiento: number;
  tasaInteresMora: number;
  periodicidadMora: PeriodicidadMora;
  porcentajeFondoReserva: number;
  quorumDefault: number;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConsorcioInput {
  nombre: string;
  administradorId: string;
  calle?: string;
  numero?: string;
  barrio?: string;
  ciudad?: string;
  provincia?: string;
  cp?: string;
  cuit?: string;
  cbu?: string;
  diaVencimiento?: number;
  tasaInteresMora?: number;
  periodicidadMora?: PeriodicidadMora;
  porcentajeFondoReserva?: number;
  quorumDefault?: number;
  activo?: boolean;
}
