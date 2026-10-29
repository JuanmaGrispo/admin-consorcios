import { ConflictException } from '@nestjs/common';
import { EstadoLiquidacion } from '../../database/entities';

/** Una acción que el estado actual de la liquidación no admite: 409, no 400. */
export class TransicionInvalida extends ConflictException {}

/**
 * El ciclo de vida de la liquidación (patrón State). Cada estado decide qué
 * acciones admite y a qué estado llevan; el service ejecuta los efectos
 * (recalcular, publicar) y guarda el resultado, que en la base sigue siendo
 * el enum. Sumar un estado es sumar una clase, sin tocar los demás.
 */
export interface EstadoDeLiquidacion {
  readonly valor: EstadoLiquidacion;
  /** Sus boletas ya cuentan como deuda de cada unidad. */
  readonly esDeuda: boolean;
  /** Tocar un gasto recalcula las boletas que están a la vista. */
  readonly recalculaAlCambiar: boolean;
  /** Gastos, criterio, vencimiento y borrarla: sólo antes de emitir. */
  exigirEditable(): void;
  exigirAjustable(): void;
  previsualizar(): EstadoLiquidacion;
  emitir(): EstadoLiquidacion;
  cerrar(): EstadoLiquidacion;
  /** Se borró el último gasto: no queda nada que previsualizar. */
  sinGastos(): EstadoLiquidacion;
}

/** Por defecto toda acción es inválida; cada estado habilita las suyas. */
abstract class EstadoBase implements EstadoDeLiquidacion {
  abstract readonly valor: EstadoLiquidacion;
  readonly esDeuda: boolean = false;
  readonly recalculaAlCambiar: boolean = false;

  exigirEditable(): void {
    throw new TransicionInvalida(
      `La liquidación está ${this.valor}: sus boletas ya son deuda y no se modifican`,
    );
  }

  exigirAjustable(): void {
    throw new TransicionInvalida('Sólo se ajustan boletas de una liquidación en previsualización');
  }

  previsualizar(): EstadoLiquidacion {
    this.exigirEditable();
    return EstadoLiquidacion.PREVISUALIZACION;
  }

  emitir(): EstadoLiquidacion {
    throw new TransicionInvalida(`La liquidación ya está ${this.valor}`);
  }

  cerrar(): EstadoLiquidacion {
    throw new TransicionInvalida('Sólo se cierra una liquidación emitida');
  }

  sinGastos(): EstadoLiquidacion {
    return this.valor;
  }
}

class Borrador extends EstadoBase {
  readonly valor = EstadoLiquidacion.BORRADOR;

  exigirEditable(): void {}

  emitir(): EstadoLiquidacion {
    throw new TransicionInvalida('Previsualizá las boletas antes de emitir');
  }
}

class Previsualizacion extends EstadoBase {
  readonly valor = EstadoLiquidacion.PREVISUALIZACION;
  readonly recalculaAlCambiar = true;

  exigirEditable(): void {}

  exigirAjustable(): void {}

  emitir(): EstadoLiquidacion {
    return EstadoLiquidacion.EMITIDA;
  }

  sinGastos(): EstadoLiquidacion {
    return EstadoLiquidacion.BORRADOR;
  }
}

class Emitida extends EstadoBase {
  readonly valor = EstadoLiquidacion.EMITIDA;
  readonly esDeuda = true;

  cerrar(): EstadoLiquidacion {
    return EstadoLiquidacion.CERRADA;
  }
}

class Cerrada extends EstadoBase {
  readonly valor = EstadoLiquidacion.CERRADA;
  readonly esDeuda = true;
}

/** Está en el enum de la base pero ningún flujo lo usa: no admite nada. */
class Prorrateo extends EstadoBase {
  readonly valor = EstadoLiquidacion.PRORRATEO;
}

const ESTADOS: Record<EstadoLiquidacion, EstadoDeLiquidacion> = {
  [EstadoLiquidacion.BORRADOR]: new Borrador(),
  [EstadoLiquidacion.PRORRATEO]: new Prorrateo(),
  [EstadoLiquidacion.PREVISUALIZACION]: new Previsualizacion(),
  [EstadoLiquidacion.EMITIDA]: new Emitida(),
  [EstadoLiquidacion.CERRADA]: new Cerrada(),
};

export function estadoDe(valor: EstadoLiquidacion): EstadoDeLiquidacion {
  return ESTADOS[valor];
}
