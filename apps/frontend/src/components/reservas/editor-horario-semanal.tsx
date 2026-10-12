'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { HorarioSemanal } from '@/types/reserva';
import { DIAS_ISO, nombreDiaIso } from './tiempo';

type Modo = 'general' | 'propio' | 'cerrado';

/** Un día mientras se edita: todo string, como el resto del formulario. */
export interface DiaEditable {
  modo: Modo;
  apertura: string;
  cierre: string;
}

export type SemanaEditable = Record<string, DiaEditable>;

/** El horario guardado → los siete días para editar. Sin horario propio, el día arranca con el general. */
export function semanaEditable(
  horario: HorarioSemanal | null | undefined,
  general: { apertura: string; cierre: string },
): SemanaEditable {
  return Object.fromEntries(
    DIAS_ISO.map((dia) => {
      const propio = horario?.[dia];
      if (propio === null) return [dia, { modo: 'cerrado', ...general }];
      if (propio) return [dia, { modo: 'propio', ...propio }];
      return [dia, { modo: 'general', ...general }];
    }),
  );
}

/** Lo que se manda: sólo las excepciones. Sin ninguna, null ("todos los días igual"). */
export function horarioParaEnviar(semana: SemanaEditable): HorarioSemanal | null {
  const horario: HorarioSemanal = {};
  for (const dia of DIAS_ISO) {
    const d = semana[dia];
    if (d.modo === 'cerrado') horario[dia] = null;
    if (d.modo === 'propio') horario[dia] = { apertura: d.apertura, cierre: d.cierre };
  }
  return Object.keys(horario).length ? horario : null;
}

/**
 * El horario de cada día de la semana (pantalla 05): el general, otro
 * horario o cerrado. Sirve para "el SUM abre hasta las 02:00 sólo viernes y
 * sábado".
 */
export function EditorHorarioSemanal({
  semana,
  onCambiar,
}: {
  semana: SemanaEditable;
  onCambiar: (semana: SemanaEditable) => void;
}) {
  const cambiar = (dia: string, cambios: Partial<DiaEditable>) =>
    onCambiar({ ...semana, [dia]: { ...semana[dia], ...cambios } });

  return (
    <ul className="flex flex-col divide-y rounded-lg border">
      {DIAS_ISO.map((dia) => {
        const d = semana[dia];
        return (
          <li key={dia} className="flex flex-wrap items-center gap-2 px-3 py-2">
            <span className="w-20 text-sm font-medium">{nombreDiaIso(dia)}</span>
            <Select value={d.modo} onValueChange={(v) => cambiar(dia, { modo: v as Modo })}>
              <SelectTrigger size="sm" className="w-40" aria-label={`Horario del ${nombreDiaIso(dia).toLowerCase()}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">Horario general</SelectItem>
                <SelectItem value="propio">Otro horario</SelectItem>
                <SelectItem value="cerrado">Cerrado</SelectItem>
              </SelectContent>
            </Select>
            {d.modo === 'propio' && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Input
                  type="time"
                  required
                  aria-label={`Abre el ${nombreDiaIso(dia).toLowerCase()}`}
                  value={d.apertura}
                  onChange={(e) => cambiar(dia, { apertura: e.target.value })}
                  className="h-8 w-28"
                />
                a
                <Input
                  type="time"
                  required
                  aria-label={`Cierra el ${nombreDiaIso(dia).toLowerCase()}`}
                  value={d.cierre}
                  onChange={(e) => cambiar(dia, { cierre: e.target.value })}
                  className="h-8 w-28"
                />
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
