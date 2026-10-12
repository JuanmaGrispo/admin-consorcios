import { EstadoBadge } from '@/components/estado-badge';
import { Progress } from '@/components/ui/progress';
import { porcentaje } from '@/lib/formato';
import type { Escrutinio, FormaConteo, MayoriaRequerida } from '@/types/votacion';

/** Las reglas con las que se decidió: hacen falta para explicar el resultado. */
export interface ReglasResultado {
  formaConteo: FormaConteo;
  mayoria: MayoriaRequerida;
}

interface EscrutinioBarrasProps {
  escrutinio: Escrutinio;
  /** Con el resultado a la vista sólo cuando la votación ya cerró. */
  cerrada: boolean;
  /** Si vienen, cerrada se explica el resultado en una línea. */
  reglas?: ReglasResultado;
}

/**
 * El resultado en palabras, con las mismas reglas que el escrutinio del
 * backend: la mayoría simple compara “A favor” contra “En contra” sobre lo
 * emitido; la absoluta y los dos tercios miden “A favor” sobre todo el padrón.
 */
export function leyendaResultado(escrutinio: Escrutinio, { formaConteo, mayoria }: ReglasResultado): string {
  if (escrutinio.resultado === 'SIN_QUORUM') {
    return escrutinio.pesoEmitido === 0
      ? 'Nadie votó: la votación no tuvo resultado.'
      : 'La asamblea no alcanzó el quórum: la votación no decidió nada.';
  }

  const porCoeficiente = formaConteo === 'POR_COEFICIENTE';
  const opcion = (etiqueta: string) => escrutinio.opciones.find((o) => o.etiqueta === etiqueta);
  const aFavor = opcion('A favor');
  const enContra = opcion('En contra');
  const aprobada = escrutinio.resultado === 'APROBADA';

  if (mayoria === 'SIMPLE_PRESENTES') {
    const de = porCoeficiente ? 'de coeficientes' : 'de los votos';
    const pFavor = porcentaje(aFavor?.porcentaje ?? 0);
    const pContra = porcentaje(enContra?.porcentaje ?? 0);
    if ((aFavor?.peso ?? 0) === (enContra?.peso ?? 0)) {
      return `Empate en ${pFavor} ${de}: se ${aprobada ? 'aprobó' : 'rechazó'} por el criterio de desempate.`;
    }
    return aprobada
      ? `Aprobada por ${pFavor} ${de} a favor (${pContra} en contra).`
      : `No alcanzó la mayoría: ${pFavor} ${de} a favor frente a ${pContra} en contra.`;
  }

  // Sobre el padrón: lo que pesó “A favor” en lo emitido, por la participación.
  const sobrePadron = porcentaje(((aFavor?.porcentaje ?? 0) * escrutinio.participacion) / 100);
  const delTotal = porCoeficiente ? 'del total de coeficientes' : 'de las unidades del padrón';
  const requerida = mayoria === 'ABSOLUTA' ? 'más del 50%' : `al menos ${porcentaje(200 / 3)}`;
  return aprobada
    ? `Aprobada por ${sobrePadron} ${delTotal} a favor (hacía falta ${requerida}).`
    : `No alcanzó la mayoría ${porCoeficiente ? 'de coeficientes ' : ''}requerida: ${sobrePadron} ${delTotal} a favor, hacía falta ${requerida}.`;
}

/** El conteo de una votación: una barra por opción, la participación y, cerrada, el resultado. */
export function EscrutinioBarras({ escrutinio, cerrada, reglas }: EscrutinioBarrasProps) {
  return (
    <div className="flex flex-col gap-3">
      {escrutinio.opciones.map((o) => (
        <div key={o.opcionId} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-medium">{o.etiqueta}</span>
            <span className="text-muted-foreground tabular-nums">
              {porcentaje(o.porcentaje)} · {o.votos} {o.votos === 1 ? 'voto' : 'votos'}
            </span>
          </div>
          <Progress value={o.porcentaje} className="h-2" />
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
        <span className="text-muted-foreground">
          Participación <span className="font-medium text-foreground tabular-nums">{porcentaje(escrutinio.participacion)}</span>
        </span>
        {cerrada ? (
          <EstadoBadge dominio="resultado" estado={escrutinio.resultado} />
        ) : (
          <span className="text-xs text-muted-foreground">Parcial: puede cambiar hasta el cierre</span>
        )}
      </div>
      {cerrada && reglas && <p className="text-sm text-secondary-foreground">{leyendaResultado(escrutinio, reglas)}</p>}
    </div>
  );
}
