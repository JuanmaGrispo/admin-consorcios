import { HttpException, HttpStatus } from '@nestjs/common';

const VENTANA_MS = 15 * 60_000;

/** Fallos tolerados dentro de la ventana antes de bloquear. */
export const MAX_FALLOS_CUENTA = 5;
/** Por IP se tolera más: una oficina comparte IP y cada uno se equivoca solo. */
export const MAX_FALLOS_IP = 20;

/** Pasada esta cantidad de claves, se barren las vencidas en vez de dejar crecer el mapa. */
const LIMPIEZA_DESDE = 10_000;

interface Registro {
  fallos: number[];
  bloqueadaHasta: number;
}

/**
 * Límite de intentos de login fallidos, por cuenta y por IP. La cuenta
 * frena la fuerza bruta contra un usuario; la IP, probar una contraseña
 * contra muchos. Vale igual para emails que no existen: si sólo se
 * bloquearan los reales, el 429 diría qué cuentas existen.
 *
 * Vive en memoria: con más de una instancia del backend cada una cuenta por
 * su lado, y un reinicio lo pone en cero.
 */
export class LimitadorLogin {
  private readonly registros = new Map<string, Registro>();

  constructor(private readonly ahora: () => number = Date.now) {}

  /** 429 si la cuenta o la IP están bloqueadas, sin mirar la contraseña. */
  exigirHabilitado(email: string, ip?: string): void {
    const hasta = Math.max(...this.claves(email, ip).map((c) => this.registros.get(c)?.bloqueadaHasta ?? 0));
    const restante = hasta - this.ahora();
    if (restante > 0) {
      const minutos = Math.ceil(restante / 60_000);
      throw new HttpException(
        `Demasiados intentos fallidos. Probá de nuevo en ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  registrarFallo(email: string, ip?: string): void {
    const ahora = this.ahora();
    if (this.registros.size > LIMPIEZA_DESDE) this.barrer(ahora);

    for (const clave of this.claves(email, ip)) {
      const registro = this.registros.get(clave) ?? { fallos: [], bloqueadaHasta: 0 };
      registro.fallos = registro.fallos.filter((t) => ahora - t < VENTANA_MS);
      registro.fallos.push(ahora);
      const maximo = clave.startsWith('ip:') ? MAX_FALLOS_IP : MAX_FALLOS_CUENTA;
      if (registro.fallos.length >= maximo) {
        registro.bloqueadaHasta = ahora + VENTANA_MS;
        registro.fallos = [];
      }
      this.registros.set(clave, registro);
    }
  }

  /** Un login correcto perdona los fallos de la cuenta, no los de la IP. */
  registrarExito(email: string): void {
    this.registros.delete(this.claveCuenta(email));
  }

  private claves(email: string, ip?: string): string[] {
    return ip ? [this.claveCuenta(email), `ip:${ip}`] : [this.claveCuenta(email)];
  }

  private claveCuenta(email: string): string {
    return `cuenta:${email.trim().toLowerCase()}`;
  }

  private barrer(ahora: number): void {
    for (const [clave, r] of this.registros) {
      if (r.bloqueadaHasta <= ahora && r.fallos.every((t) => ahora - t >= VENTANA_MS)) {
        this.registros.delete(clave);
      }
    }
  }
}
