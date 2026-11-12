/** Llamadas que se miran para decidir. */
export const VENTANA_LLAMADAS = 20;
/** Fallas dentro de la ventana que abren el disyuntor. */
export const FALLAS_PARA_ABRIR = 5;
export const ABIERTO_MS = 5 * 60_000;

/**
 * Disyuntor del modelo: con 5 fallas en las últimas 20 llamadas deja de
 * llamar al modelo por 5 minutos y todo va al manual. Evita que cada vecino
 * espere 15 s de timeout cuando el proveedor está caído.
 *
 * Vive en memoria, como el limitador de login: cada instancia del backend
 * decide por su lado.
 */
export class Disyuntor {
  private resultados: boolean[] = [];
  private abiertoHasta = 0;

  constructor(private readonly ahora: () => number = Date.now) {}

  get abierto(): boolean {
    return this.ahora() < this.abiertoHasta;
  }

  registrar(exito: boolean): void {
    this.resultados.push(exito);
    if (this.resultados.length > VENTANA_LLAMADAS) this.resultados.shift();
    if (this.resultados.filter((r) => !r).length >= FALLAS_PARA_ABRIR) {
      this.abiertoHasta = this.ahora() + ABIERTO_MS;
      // Al cerrarse arranca de cero: si no, la primera falla lo volvería a abrir.
      this.resultados = [];
    }
  }
}
