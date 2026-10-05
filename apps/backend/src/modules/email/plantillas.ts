import { fechaLegible, instanteLegible, mesLegible } from '../../core/formato';
import type { EventoDomus } from '../../core/mensajeria/eventos';

export interface Mensaje {
  asunto: string;
  texto: string;
  html: string;
}

export interface Contexto {
  nombre: string;
  /** Sólo para expensas: lo que le toca pagar por cada unidad. */
  unidades?: { etiqueta: string; total: number }[];
}

const MAYORIAS: Record<string, string> = {
  SIMPLE_PRESENTES: 'mayoría simple de los votos emitidos',
  ABSOLUTA: 'mayoría absoluta del padrón',
  DOS_TERCIOS: 'dos tercios del padrón',
};

const RESULTADOS: Record<string, string> = {
  aprobada: 'se aprobó',
  rechazada: 'se rechazó',
  sin_quorum: 'no alcanzó el quórum, así que no decide nada',
};

const pesos = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

const escapar = (texto: string) =>
  texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function armar(asunto: string, parrafos: string[]): Mensaje {
  return {
    asunto,
    texto: parrafos.join('\n\n'),
    html: parrafos.map((p) => `<p>${escapar(p).replace(/\n/g, '<br>')}</p>`).join(''),
  };
}

/** El mail que recibe una persona por un evento. Función pura: no sabe de SMTP ni de la base. */
export function redactar(evento: EventoDomus, ctx: Contexto): Mensaje {
  const hola = `Hola ${ctx.nombre},`;
  const portal = 'Entrá al portal de Domus para ver el detalle.';

  switch (evento.tipo_evento) {
    case 'expensas.emitidas': {
      const p = evento.payload;
      const detalle = (ctx.unidades ?? [])
        .map((u) => `Unidad ${u.etiqueta}: ${pesos(u.total)}`)
        .join('\n');
      return armar(`Expensas de ${mesLegible(p.periodo)}`, [
        hola,
        `Ya están las expensas de ${mesLegible(p.periodo)}. Vencen el ${fechaLegible(p.fecha_vencimiento)}.`,
        ...(detalle ? [detalle] : []),
        'Podés verlas y pagarlas desde el portal.',
      ]);
    }
    case 'asamblea.creada':
    case 'asamblea.recordatorio': {
      const p = evento.payload;
      const donde = p.lugar ? ` en ${p.lugar}` : '';
      const cuando = `el ${fechaLegible(p.fecha)} a las ${p.hora}${donde}`;
      return evento.tipo_evento === 'asamblea.creada'
        ? armar(`Citación: ${p.titulo}`, [
            hola,
            `Se convocó la asamblea "${p.titulo}" para ${cuando}.`,
            'Confirmá tu asistencia desde el portal.',
          ])
        : armar(`Recordatorio: ${p.titulo}`, [
            hola,
            `Te recordamos que la asamblea "${p.titulo}" es ${cuando}.`,
            portal,
          ]);
    }
    case 'votacion.nueva': {
      const p = evento.payload;
      return armar(`Nueva votación: ${p.titulo}`, [
        hola,
        `Se abrió la votación "${p.titulo}". Cierra el ${instanteLegible(p.fecha_cierre)} y se aprueba por ${
          MAYORIAS[p.mayoria_necesaria] ?? p.mayoria_necesaria
        }.`,
        'Podés votar desde el portal.',
      ]);
    }
    case 'votacion.cerrada': {
      const p = evento.payload;
      return armar(`Resultado: ${p.titulo}`, [
        hola,
        `La votación "${p.titulo}" ${RESULTADOS[p.resultado] ?? p.resultado}. Participó el ${p.participacion_pct}% del padrón.`,
        portal,
      ]);
    }
    case 'reclamo.cerrado': {
      const p = evento.payload;
      return armar(`Tu reclamo ${p.codigo} está resuelto`, [
        hola,
        `Dimos por resuelto tu reclamo ${p.codigo} (${p.categoria}).`,
        ...(p.resolucion ? [p.resolucion] : []),
        'Si el problema sigue, respondé desde el portal y lo reabrimos.',
      ]);
    }
    case 'novedad.publicada':
      return armar(`Novedad: ${evento.payload.titulo}`, [
        hola,
        `Hay una novedad nueva en el muro de tu edificio: "${evento.payload.titulo}".`,
        portal,
      ]);
    case 'aviso.directo':
      return armar(evento.payload.asunto, [hola, evento.payload.cuerpo]);
  }
}
