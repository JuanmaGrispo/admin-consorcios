export type TipoUnidad = 'DEPARTAMENTO' | 'LOCAL' | 'COCHERA' | 'BAULERA';

/** GET /unidades: al vecino le devuelve las suyas; al administrador, las de sus consorcios. */
export interface Unidad {
  id: string;
  consorcioId: string;
  /** "3º B", "PB Local". */
  etiqueta: string;
  piso: string | null;
  departamento: string | null;
  tipo: TipoUnidad;
  /** Porcentaje (1.74 es 1,74%). */
  coeficiente: number;
  metrosCuadrados: number | null;
  activa: boolean;
  /** Vínculos vigentes: cuántos vecinos tiene hoy. */
  cantidadVecinos?: number;
}

/** POST /unidades */
export interface UnidadInput {
  consorcioId: string;
  etiqueta: string;
  piso?: string;
  departamento?: string;
  tipo?: TipoUnidad;
  coeficiente: number;
  metrosCuadrados?: number;
}

/** PATCH /unidades/:id: el consorcio no se cambia; `activa: false` la da de baja. */
export type UnidadCambios = Partial<Omit<UnidadInput, 'consorcioId'>> & { activa?: boolean };

export type VinculoUnidad = 'PROPIETARIO' | 'INQUILINO';

/** GET /unidades/:id/vinculos: quién vive o vivió en la unidad. */
export interface Vinculo {
  id: string;
  unidadId: string;
  usuarioId: string;
  usuario: { id: string; nombre: string; apellido: string; email: string };
  vinculo: VinculoUnidad;
  /** Responsable principal: hay uno solo vigente por unidad. */
  esTitular: boolean;
  /** Fechas sin hora (`2026-09-10`). */
  desde: string;
  /** Null mientras sigue vigente. */
  hasta: string | null;
}

/** Los datos de un vecino que se da de alta al vincularlo. */
export interface NuevoVecinoInput {
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  dni?: string;
  telefono?: string;
}

/** POST /unidades/:id/vinculos: va `usuarioId` o `nuevoUsuario`, uno de los dos. */
export interface VinculoInput {
  usuarioId?: string;
  nuevoUsuario?: NuevoVecinoInput;
  vinculo: VinculoUnidad;
  esTitular?: boolean;
  desde?: string;
}
