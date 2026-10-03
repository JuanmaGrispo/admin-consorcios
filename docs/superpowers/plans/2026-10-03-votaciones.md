# Módulo Votaciones — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar `votaciones` según [el spec](../specs/2026-10-03-votaciones-design.md): ABM, opciones, publicación y cierre, voto desde la app y presencial, padrón, escrutinio, e integrarlo con asambleas e inicio.

**Architecture:** Módulo plano `apps/backend/src/modules/votaciones/` (controller → service → repository). Padrón y escrutinio son funciones puras con tests propios. El módulo lee `asamblea`/`punto_orden_dia`/`asistencia` por su cuenta para no importar `AsambleasModule` (asambleas es el que pregunta por votaciones). Sin cambios de esquema.

**Tech Stack:** NestJS 11, TypeORM 0.3, class-validator, `node:test`.

**Reglas:** commits atómicos, sin co-autoría; español en dominio, inglés en lo técnico.

**Comandos** (desde `apps/backend`): `corepack pnpm test`, `node --require ts-node/register/transpile-only --test <archivo>`, `corepack pnpm exec tsc --noEmit -p tsconfig.json`, `corepack pnpm build`.

Cada archivo nuevo aparece completo, precedido por una línea `Archivo:` con su ruta.

---

## Mapa de archivos

| Archivo | Acción |
|---|---|
| `src/modules/votaciones/escrutinio.ts` (+ `.spec`) | crear |
| `src/modules/votaciones/padron.ts` (+ `.spec`) | crear |
| `src/modules/votaciones/dto/*.ts` | crear |
| `src/modules/votaciones/votaciones.repository.ts` | crear |
| `src/modules/votaciones/votaciones.service.ts` (+ `.spec`) | crear |
| `src/modules/votaciones/votaciones.controller.ts`, `votaciones.module.ts` | crear |
| `src/app.module.ts` | registrar `VotacionesModule` antes de `InicioModule` |
| `src/modules/asambleas/*` | no cerrar con votaciones abiertas |
| `src/modules/inicio/*` | votaciones abiertas en `proximosEventos` |
| `README.md` | sección "Votaciones" |

---

### Task 1: Escrutinio

- [ ] **Step 1: test que falla**

Archivo: `apps/backend/src/modules/votaciones/escrutinio.spec.ts`
```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CriterioDesempate, MayoriaRequerida, ResultadoVotacion } from '../../database/entities';
import { escrutar, type ReglasEscrutinio } from './escrutinio';

const OPCIONES = [
  { id: 'si', etiqueta: 'A favor' },
  { id: 'no', etiqueta: 'En contra' },
  { id: 'abs', etiqueta: 'Abstención' },
];

const reglas = (over: Partial<ReglasEscrutinio> = {}): ReglasEscrutinio => ({
  mayoria: MayoriaRequerida.SIMPLE_PRESENTES,
  desempate: CriterioDesempate.RECHAZADA,
  aFavorId: 'si',
  enContraId: 'no',
  pesoPadron: 100,
  ...over,
});

const v = (opcionId: string, peso: number) => ({ opcionId, peso });

describe('escrutar', () => {
  it('suma por opción y calcula porcentajes sobre lo emitido', () => {
    const e = escrutar(OPCIONES, [v('si', 30), v('no', 20), v('abs', 50)], reglas());
    assert.deepEqual(
      e.opciones.map((o) => [o.opcionId, o.peso, o.porcentaje, o.votos]),
      [
        ['si', 30, 30, 1],
        ['no', 20, 20, 1],
        ['abs', 50, 50, 1],
      ],
    );
    assert.equal(e.pesoEmitido, 100);
    assert.equal(e.participacion, 100);
  });

  it('simple: aprueba si A favor supera a En contra, sin contar abstenciones', () => {
    const e = escrutar(OPCIONES, [v('si', 10), v('no', 5), v('abs', 80)], reglas());
    assert.equal(e.resultado, ResultadoVotacion.APROBADA);
  });

  it('simple: rechaza si En contra gana', () => {
    const e = escrutar(OPCIONES, [v('si', 5), v('no', 10)], reglas());
    assert.equal(e.resultado, ResultadoVotacion.RECHAZADA);
  });

  it('simple: el empate lo decide el desempate', () => {
    const empate = [v('si', 10), v('no', 10)];
    assert.equal(escrutar(OPCIONES, empate, reglas()).resultado, ResultadoVotacion.RECHAZADA);
    assert.equal(
      escrutar(OPCIONES, empate, reglas({ desempate: CriterioDesempate.APROBADA })).resultado,
      ResultadoVotacion.APROBADA,
    );
  });

  it('absoluta: necesita más de la mitad del padrón, voten o no', () => {
    const r = reglas({ mayoria: MayoriaRequerida.ABSOLUTA });
    assert.equal(escrutar(OPCIONES, [v('si', 40)], r).resultado, ResultadoVotacion.RECHAZADA);
    assert.equal(escrutar(OPCIONES, [v('si', 50.01)], r).resultado, ResultadoVotacion.APROBADA);
    assert.equal(escrutar(OPCIONES, [v('si', 50)], r).resultado, ResultadoVotacion.RECHAZADA);
  });

  it('dos tercios: aprueba desde 2/3 del padrón', () => {
    const r = reglas({ mayoria: MayoriaRequerida.DOS_TERCIOS, pesoPadron: 3 });
    assert.equal(escrutar(OPCIONES, [v('si', 2)], r).resultado, ResultadoVotacion.APROBADA);
    assert.equal(escrutar(OPCIONES, [v('si', 1.9999)], r).resultado, ResultadoVotacion.RECHAZADA);
  });

  it('sin votos es SIN_QUORUM', () => {
    assert.equal(escrutar(OPCIONES, [], reglas()).resultado, ResultadoVotacion.SIN_QUORUM);
  });

  it('una asamblea sin quórum da SIN_QUORUM aunque haya votos', () => {
    const e = escrutar(OPCIONES, [v('si', 90)], reglas({ sinQuorum: true }));
    assert.equal(e.resultado, ResultadoVotacion.SIN_QUORUM);
  });

  it('los flotantes no inventan un ganador', () => {
    // 0.1 + 0.2 da 0.30000000000000004 en punto flotante.
    const e = escrutar(OPCIONES, [v('si', 0.1), v('si', 0.2), v('no', 0.3)], reglas());
    assert.equal(e.resultado, ResultadoVotacion.RECHAZADA);
  });
});
```

- [ ] **Step 2:** `node --require ts-node/register/transpile-only --test src/modules/votaciones/escrutinio.spec.ts` → FAIL (`Cannot find module './escrutinio'`).

- [ ] **Step 3: implementar**

Archivo: `apps/backend/src/modules/votaciones/escrutinio.ts`
```ts
import { CriterioDesempate, MayoriaRequerida, ResultadoVotacion } from '../../database/entities';

export interface OpcionParaEscrutinio {
  id: string;
  etiqueta: string;
}

export interface VotoParaEscrutinio {
  opcionId: string;
  /** Coeficiente de la unidad o 1, según la forma de conteo. */
  peso: number;
}

export interface ReglasEscrutinio {
  mayoria: MayoriaRequerida;
  desempate: CriterioDesempate;
  aFavorId: string;
  enContraId: string;
  /** Peso total del padrón: el 100% para la mayoría absoluta y los dos tercios. */
  pesoPadron: number;
  /** De asamblea, y la asamblea no tenía quórum al cerrar la votación. */
  sinQuorum?: boolean;
}

export interface ConteoOpcion {
  opcionId: string;
  etiqueta: string;
  peso: number;
  votos: number;
  /** Sobre lo emitido, con dos decimales. */
  porcentaje: number;
}

export interface Escrutinio {
  opciones: ConteoOpcion[];
  pesoEmitido: number;
  /** Peso emitido sobre el del padrón, en %. */
  participacion: number;
  resultado: ResultadoVotacion;
}

/** Los coeficientes tienen 4 decimales: comparar más fino sólo mide ruido de punto flotante. */
const r4 = (n: number) => Math.round(n * 10_000) / 10_000;
const r2 = (n: number) => Math.round(n * 100) / 100;

export function escrutar(
  opciones: OpcionParaEscrutinio[],
  votos: VotoParaEscrutinio[],
  reglas: ReglasEscrutinio,
): Escrutinio {
  const acumulado = new Map(opciones.map((o) => [o.id, { peso: 0, votos: 0 }]));
  let emitido = 0;
  for (const voto of votos) {
    const cuenta = acumulado.get(voto.opcionId);
    if (!cuenta) continue;
    cuenta.peso += voto.peso;
    cuenta.votos += 1;
    emitido += voto.peso;
  }
  emitido = r4(emitido);

  const conteo = opciones.map((o): ConteoOpcion => {
    const cuenta = acumulado.get(o.id)!;
    return {
      opcionId: o.id,
      etiqueta: o.etiqueta,
      peso: r4(cuenta.peso),
      votos: cuenta.votos,
      porcentaje: emitido > 0 ? r2((cuenta.peso / emitido) * 100) : 0,
    };
  });

  const aFavor = acumulado.get(reglas.aFavorId)?.peso ?? 0;
  const enContra = acumulado.get(reglas.enContraId)?.peso ?? 0;

  return {
    opciones: conteo,
    pesoEmitido: emitido,
    participacion: reglas.pesoPadron > 0 ? r2((emitido / reglas.pesoPadron) * 100) : 0,
    resultado: decidir(aFavor, enContra, emitido, reglas),
  };
}

function decidir(
  aFavor: number,
  enContra: number,
  emitido: number,
  reglas: ReglasEscrutinio,
): ResultadoVotacion {
  if (reglas.sinQuorum || emitido === 0) return ResultadoVotacion.SIN_QUORUM;

  const desempate =
    reglas.desempate === CriterioDesempate.APROBADA
      ? ResultadoVotacion.APROBADA
      : ResultadoVotacion.RECHAZADA;

  switch (reglas.mayoria) {
    case MayoriaRequerida.SIMPLE_PRESENTES:
      return comparar(aFavor, enContra, desempate);
    case MayoriaRequerida.ABSOLUTA:
      return comparar(aFavor, reglas.pesoPadron / 2, desempate);
    case MayoriaRequerida.DOS_TERCIOS:
      // Alcanzar los dos tercios ya aprueba: no hay empate posible.
      return r4(aFavor * 3) >= r4(reglas.pesoPadron * 2)
        ? ResultadoVotacion.APROBADA
        : ResultadoVotacion.RECHAZADA;
  }
}

function comparar(a: number, b: number, empate: ResultadoVotacion): ResultadoVotacion {
  const [x, y] = [r4(a), r4(b)];
  if (x > y) return ResultadoVotacion.APROBADA;
  if (x < y) return ResultadoVotacion.RECHAZADA;
  return empate;
}
```

- [ ] **Step 4:** correr el test → PASS (9).
- [ ] **Step 5: commit** — `feat(votaciones): escrutinio por mayoría y desempate` (porqué: una sola función decide el resultado del que depende si un gasto se puede cobrar, testeable sin base).

---

### Task 2: Padrón

- [ ] **Step 1: test que falla**

Archivo: `apps/backend/src/modules/votaciones/padron.spec.ts`
```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FormaConteo, PadronVotacion, VinculoUnidad } from '../../database/entities';
import { armarPadron, pesoTotal, type UnidadParaPadron } from './padron';

const { PROPIETARIO, INQUILINO } = VinculoUnidad;

const UNIDADES: UnidadParaPadron[] = [
  { unidadId: 'u1', etiqueta: '1A', coeficiente: 2.5, vinculos: [{ usuarioId: 'p1', vinculo: PROPIETARIO }] },
  {
    unidadId: 'u2',
    etiqueta: '1B',
    coeficiente: 1.5,
    vinculos: [
      { usuarioId: 'p2', vinculo: PROPIETARIO },
      { usuarioId: 'i2', vinculo: INQUILINO },
    ],
  },
  { unidadId: 'u3', etiqueta: '2A', coeficiente: 3, vinculos: [{ usuarioId: 'i3', vinculo: INQUILINO }] },
  { unidadId: 'u4', etiqueta: '2B', coeficiente: 1, vinculos: [] },
];

describe('armarPadron', () => {
  it('solo propietarios: deja afuera la unidad sin propietario y al inquilino', () => {
    const padron = armarPadron(UNIDADES, PadronVotacion.SOLO_PROPIETARIOS, FormaConteo.POR_COEFICIENTE);
    assert.deepEqual([...padron.keys()], ['u1', 'u2']);
    assert.deepEqual(padron.get('u2')!.votantes, ['p2']);
  });

  it('todas las unidades: vota cualquier vínculo, pero no una unidad sin nadie', () => {
    const padron = armarPadron(UNIDADES, PadronVotacion.TODAS_LAS_UNIDADES, FormaConteo.POR_COEFICIENTE);
    assert.deepEqual([...padron.keys()], ['u1', 'u2', 'u3']);
    assert.deepEqual(padron.get('u2')!.votantes, ['p2', 'i2']);
  });

  it('por coeficiente pesa el coeficiente; por unidad, 1', () => {
    const porCoef = armarPadron(UNIDADES, PadronVotacion.SOLO_PROPIETARIOS, FormaConteo.POR_COEFICIENTE);
    const porUnidad = armarPadron(UNIDADES, PadronVotacion.SOLO_PROPIETARIOS, FormaConteo.POR_UNIDAD);
    assert.equal(pesoTotal(porCoef), 4);
    assert.equal(pesoTotal(porUnidad), 2);
  });

  it('un usuario vinculado dos veces a la misma unidad vota una sola', () => {
    const padron = armarPadron(
      [
        {
          unidadId: 'u1',
          etiqueta: '1A',
          coeficiente: 1,
          vinculos: [
            { usuarioId: 'p1', vinculo: PROPIETARIO },
            { usuarioId: 'p1', vinculo: PROPIETARIO },
          ],
        },
      ],
      PadronVotacion.SOLO_PROPIETARIOS,
      FormaConteo.POR_UNIDAD,
    );
    assert.deepEqual(padron.get('u1')!.votantes, ['p1']);
  });
});
```

- [ ] **Step 2:** correr → FAIL.

- [ ] **Step 3: implementar**

Archivo: `apps/backend/src/modules/votaciones/padron.ts`
```ts
import { FormaConteo, PadronVotacion, VinculoUnidad } from '../../database/entities';

export interface UnidadParaPadron {
  unidadId: string;
  etiqueta: string;
  coeficiente: number;
  /** Vínculos vigentes de la unidad. */
  vinculos: { usuarioId: string; vinculo: VinculoUnidad }[];
}

export interface UnidadHabilitada {
  unidadId: string;
  etiqueta: string;
  /** Coeficiente o 1, según la forma de conteo. */
  peso: number;
  /** Quiénes pueden votar por esta unidad desde la app. */
  votantes: string[];
}

/**
 * Qué unidades votan y quién por cada una. Una unidad sin nadie que la pueda
 * representar no entra: no tendría quién vote y sólo inflaría el total.
 */
export function armarPadron(
  unidades: UnidadParaPadron[],
  padron: PadronVotacion,
  forma: FormaConteo,
): Map<string, UnidadHabilitada> {
  const habilitadas = new Map<string, UnidadHabilitada>();
  for (const unidad of unidades) {
    const votantes = [
      ...new Set(
        unidad.vinculos
          .filter(
            (v) =>
              padron === PadronVotacion.TODAS_LAS_UNIDADES || v.vinculo === VinculoUnidad.PROPIETARIO,
          )
          .map((v) => v.usuarioId),
      ),
    ];
    if (votantes.length === 0) continue;
    habilitadas.set(unidad.unidadId, {
      unidadId: unidad.unidadId,
      etiqueta: unidad.etiqueta,
      peso: forma === FormaConteo.POR_UNIDAD ? 1 : unidad.coeficiente,
      votantes,
    });
  }
  return habilitadas;
}

export function pesoTotal(padron: Map<string, UnidadHabilitada>): number {
  let total = 0;
  for (const unidad of padron.values()) total += unidad.peso;
  return Math.round(total * 10_000) / 10_000;
}
```

- [ ] **Step 4:** correr → PASS (4).
- [ ] **Step 5: commit** — `feat(votaciones): padrón según propietarios y forma de conteo`.

---

### Task 3: DTOs

Archivo: `apps/backend/src/modules/votaciones/dto/create-votacion.dto.ts`
```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  MaxLength,
} from 'class-validator';
import {
  CriterioDesempate,
  FormaConteo,
  MayoriaRequerida,
  PadronVotacion,
} from '../../../database/entities';

export class CreateVotacionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  consorcioId: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Punto CON_VOTACION del orden del día. Sin esto, la votación es independiente.',
  })
  @IsOptional()
  @IsUUID()
  puntoOrdenDiaId?: string;

  @ApiProperty({ example: 'Cambio de la bomba de agua' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  titulo: string;

  @ApiPropertyOptional({ example: 'Presupuesto de $ 3.480.000 en 3 cuotas.' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  descripcion?: string | null;

  @ApiPropertyOptional({ description: 'La URL que devolvió POST /archivos?destino=votaciones' })
  @IsOptional()
  @IsUrl()
  adjuntoUrl?: string | null;

  @ApiPropertyOptional({ enum: PadronVotacion, default: PadronVotacion.SOLO_PROPIETARIOS })
  @IsOptional()
  @IsEnum(PadronVotacion)
  padron?: PadronVotacion;

  @ApiPropertyOptional({ enum: FormaConteo, default: FormaConteo.POR_COEFICIENTE })
  @IsOptional()
  @IsEnum(FormaConteo)
  formaConteo?: FormaConteo;

  @ApiPropertyOptional({ enum: MayoriaRequerida, default: MayoriaRequerida.SIMPLE_PRESENTES })
  @IsOptional()
  @IsEnum(MayoriaRequerida)
  mayoria?: MayoriaRequerida;

  @ApiPropertyOptional({ enum: CriterioDesempate, default: CriterioDesempate.RECHAZADA })
  @IsOptional()
  @IsEnum(CriterioDesempate)
  desempate?: CriterioDesempate;

  @ApiPropertyOptional({ default: false, description: 'Sólo de asamblea: votar desde la app antes de que empiece' })
  @IsOptional()
  @IsBoolean()
  permiteVotoAnticipado?: boolean;

  @ApiPropertyOptional({ default: false, description: 'El vecino ve el parcial antes del cierre' })
  @IsOptional()
  @IsBoolean()
  mostrarParcial?: boolean;

  @ApiPropertyOptional({ default: false, description: 'Una unidad con expensas vencidas no vota' })
  @IsOptional()
  @IsBoolean()
  bloqueaConDeuda?: boolean;

  @ApiPropertyOptional({ example: '2026-11-01T09:00:00-03:00', description: 'Obligatoria si es independiente' })
  @IsOptional()
  @IsDateString()
  apertura?: string;

  @ApiPropertyOptional({ example: '2026-11-08T21:00:00-03:00', description: 'Obligatorio si es independiente' })
  @IsOptional()
  @IsDateString()
  cierre?: string;

  @ApiPropertyOptional({
    example: ['Abstención'],
    description: 'Opciones además de "A favor" y "En contra", que siempre están',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(60, { each: true })
  opciones?: string[];
}
```

Archivo: `apps/backend/src/modules/votaciones/dto/update-votacion.dto.ts`
```ts
import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateVotacionDto } from './create-votacion.dto';

/**
 * Ni el consorcio ni el punto del orden del día se cambian: definen dónde se
 * vota. Las opciones se reemplazan aparte, con `PUT /votaciones/:id/opciones`.
 */
export class UpdateVotacionDto extends PartialType(
  OmitType(CreateVotacionDto, ['consorcioId', 'puntoOrdenDiaId', 'opciones'] as const),
) {}
```

Archivo: `apps/backend/src/modules/votaciones/dto/reemplazar-opciones.dto.ts`
```ts
import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReemplazarOpcionesDto {
  @ApiProperty({ example: ['Abstención'], description: 'Las opciones no fijas, en orden' })
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(60, { each: true })
  opciones: string[];
}
```

Archivo: `apps/backend/src/modules/votaciones/dto/listar-votaciones.query.ts`
```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { EstadoVotacion } from '../../../database/entities';

export class ListarVotacionesQuery {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  consorcioId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  asambleaId?: string;

  @ApiPropertyOptional({ enum: EstadoVotacion })
  @IsOptional()
  @IsEnum(EstadoVotacion)
  estado?: EstadoVotacion;
}
```

Archivo: `apps/backend/src/modules/votaciones/dto/votar.dto.ts`
```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class VotarDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  opcionId: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Sólo si vota por más de una unidad' })
  @IsOptional()
  @IsUUID()
  unidadId?: string;
}
```

Archivo: `apps/backend/src/modules/votaciones/dto/voto-presencial.dto.ts`
```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class VotoPresencialDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  opcionId: string;
}
```

- [ ] `tsc --noEmit` → sin errores.
- [ ] **Commit** — `feat(votaciones): DTOs de votación, opciones y voto`.

---

### Task 4: Repository

Archivo: `apps/backend/src/modules/votaciones/votaciones.repository.ts`
```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Brackets,
  DataSource,
  DeepPartial,
  EntityManager,
  In,
  IsNull,
  LessThanOrEqual,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
  Asistencia,
  EstadoVotacion,
  OpcionVoto,
  PuntoOrdenDia,
  Unidad,
  UnidadUsuario,
  VinculoUnidad,
  Votacion,
  Voto,
} from '../../database/entities';
import { ListarVotacionesQuery } from './dto/listar-votaciones.query';
import type { UnidadParaPadron } from './padron';

export const ETIQUETA_A_FAVOR = 'A favor';
export const ETIQUETA_EN_CONTRA = 'En contra';

/** Relaciones que el detalle, el voto y el cierre necesitan siempre. */
const RELACIONES = { opcionVotos: true, asamblea: true } as const;
const ORDEN_OPCIONES = { opcionVotos: { orden: 'ASC' } } as const;

@Injectable()
export class VotacionesRepository {
  constructor(
    @InjectRepository(Votacion)
    private readonly votaciones: Repository<Votacion>,
    @InjectRepository(OpcionVoto)
    private readonly opciones: Repository<OpcionVoto>,
    @InjectRepository(Voto)
    private readonly votos: Repository<Voto>,
    @InjectRepository(PuntoOrdenDia)
    private readonly puntos: Repository<PuntoOrdenDia>,
    @InjectRepository(Asistencia)
    private readonly asistenciasRepo: Repository<Asistencia>,
    @InjectRepository(Unidad)
    private readonly unidades: Repository<Unidad>,
    @InjectRepository(UnidadUsuario)
    private readonly vinculos: Repository<UnidadUsuario>,
    private readonly dataSource: DataSource,
  ) {}

  // ── Votaciones ─────────────────────────────────────────────────────────────

  listar(
    query: ListarVotacionesQuery,
    filtro: { consorcioIds?: string[]; ocultarBorradores: boolean },
  ): Promise<Votacion[]> {
    if (filtro.consorcioIds && filtro.consorcioIds.length === 0) return Promise.resolve([]);

    const qb = this.votaciones
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.opcionVotos', 'o')
      .orderBy('v.apertura', 'DESC')
      .addOrderBy('o.orden', 'ASC');

    if (query.consorcioId) qb.andWhere('v.consorcio_id = :consorcioId', { consorcioId: query.consorcioId });
    if (filtro.consorcioIds) qb.andWhere('v.consorcio_id IN (:...consorcioIds)', { consorcioIds: filtro.consorcioIds });
    if (query.asambleaId) qb.andWhere('v.asamblea_id = :asambleaId', { asambleaId: query.asambleaId });
    if (filtro.ocultarBorradores) qb.andWhere('v.estado <> :borrador', { borrador: EstadoVotacion.BORRADOR });
    if (query.estado) qb.andWhere('v.estado = :estado', { estado: query.estado });

    return qb.getMany();
  }

  findById(id: string): Promise<Votacion | null> {
    return this.votaciones.findOne({ where: { id }, relations: RELACIONES, order: ORDEN_OPCIONES });
  }

  /** Independientes abiertas con el cierre ya pasado: se cierran en la próxima consulta. */
  abiertasVencidas(): Promise<Votacion[]> {
    return this.votaciones.find({
      where: { estado: EstadoVotacion.ABIERTA, asambleaId: IsNull(), cierre: LessThanOrEqual(new Date()) },
      relations: RELACIONES,
      order: ORDEN_OPCIONES,
    });
  }

  abiertas(consorcioIds: string[]): Promise<Votacion[]> {
    return this.votaciones.find({
      where: { consorcioId: In(consorcioIds), estado: EstadoVotacion.ABIERTA },
      order: { cierre: 'ASC' },
    });
  }

  findPunto(id: string): Promise<PuntoOrdenDia | null> {
    return this.puntos.findOne({ where: { id }, relations: { asamblea: true } });
  }

  async puntoTieneVotacion(puntoOrdenDiaId: string): Promise<boolean> {
    return (await this.votaciones.count({ where: { puntoOrdenDiaId } })) > 0;
  }

  /** La votación nace con sus dos opciones fijas: sin ellas no hay resultado posible. */
  crear(datos: DeepPartial<Votacion>, extras: string[]): Promise<string> {
    return this.dataSource.transaction(async (m) => {
      const votacion = await m.save(m.create(Votacion, datos));
      await m.save([
        m.create(OpcionVoto, { votacionId: votacion.id, etiqueta: ETIQUETA_A_FAVOR, orden: 1, esFija: true }),
        m.create(OpcionVoto, { votacionId: votacion.id, etiqueta: ETIQUETA_EN_CONTRA, orden: 2, esFija: true }),
      ]);
      await this.insertarExtras(m, votacion.id, extras);
      return votacion.id;
    });
  }

  async actualizar(id: string, cambios: QueryDeepPartialEntity<Votacion>): Promise<void> {
    await this.votaciones.update({ id }, { ...cambios, updatedAt: new Date() });
  }

  async reemplazarOpciones(votacionId: string, extras: string[]): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      await m.delete(OpcionVoto, { votacionId, esFija: false });
      await this.insertarExtras(m, votacionId, extras);
    });
  }

  async eliminar(id: string): Promise<void> {
    await this.votaciones.delete({ id });
  }

  // ── Votos ──────────────────────────────────────────────────────────────────

  votosDe(votacionId: string): Promise<Voto[]> {
    return this.votos.find({ where: { votacionId }, relations: { emitidoPor: true } });
  }

  findVoto(votacionId: string, unidadId: string): Promise<Voto | null> {
    return this.votos.findOne({ where: { votacionId, unidadId }, relations: { emitidoPor: true } });
  }

  /**
   * `null` si la unidad ya votó. El chequeo previo del service no alcanza: dos
   * votos simultáneos pasan los dos, y el que decide es el UNIQUE de la base.
   */
  async crearVoto(datos: DeepPartial<Voto>): Promise<Voto | null> {
    try {
      return await this.votos.save(this.votos.create(datos));
    } catch (error) {
      if (esViolacionUnique(error)) return null;
      throw error;
    }
  }

  // ── Padrón, asamblea y vecinos ─────────────────────────────────────────────

  /** Unidades activas del consorcio con sus vínculos vigentes, para armar el padrón. */
  async unidadesParaPadron(consorcioId: string): Promise<UnidadParaPadron[]> {
    const unidades = await this.unidades.find({
      where: { consorcioId, activa: true },
      select: { id: true, etiqueta: true, coeficiente: true },
      order: { etiqueta: 'ASC' },
    });
    const vinculos = await this.vinculosVigentes()
      .select('v.unidad_id', 'unidadId')
      .addSelect('v.usuario_id', 'usuarioId')
      .addSelect('v.vinculo', 'vinculo')
      .andWhere('u.consorcio_id = :consorcioId', { consorcioId })
      .getRawMany<{ unidadId: string; usuarioId: string; vinculo: VinculoUnidad }>();

    return unidades.map((u) => ({
      unidadId: u.id,
      etiqueta: u.etiqueta,
      coeficiente: u.coeficiente,
      vinculos: vinculos
        .filter((v) => v.unidadId === u.id)
        .map((v) => ({ usuarioId: v.usuarioId, vinculo: v.vinculo })),
    }));
  }

  asistenciasDe(asambleaId: string): Promise<Asistencia[]> {
    return this.asistenciasRepo.find({ where: { asambleaId } });
  }

  async consorciosDelUsuario(usuarioId: string): Promise<string[]> {
    const filas = await this.vinculosVigentes()
      .select('DISTINCT u.consorcio_id', 'consorcioId')
      .andWhere('v.usuario_id = :usuarioId', { usuarioId })
      .getRawMany<{ consorcioId: string }>();
    return filas.map((f) => f.consorcioId);
  }

  async vecinosDelConsorcio(consorcioId: string): Promise<string[]> {
    const filas = await this.vinculosVigentes()
      .select('DISTINCT v.usuario_id', 'usuarioId')
      .andWhere('u.consorcio_id = :consorcioId', { consorcioId })
      .andWhere('u.activa = true')
      .getRawMany<{ usuarioId: string }>();
    return filas.map((f) => f.usuarioId);
  }

  // ── Privados ───────────────────────────────────────────────────────────────

  private vinculosVigentes(): SelectQueryBuilder<UnidadUsuario> {
    return this.vinculos
      .createQueryBuilder('v')
      .innerJoin('v.unidad', 'u')
      .where(new Brackets((qb) => qb.where('v.hasta IS NULL').orWhere('v.hasta >= CURRENT_DATE')));
  }

  /** Van después de las fijas (orden 1 y 2). */
  private async insertarExtras(m: EntityManager, votacionId: string, extras: string[]) {
    if (extras.length === 0) return;
    await m.save(
      extras.map((etiqueta, i) =>
        m.create(OpcionVoto, { votacionId, etiqueta, orden: i + 3, esFija: false }),
      ),
    );
  }
}

/** Postgres responde 23505 cuando se viola un UNIQUE. */
function esViolacionUnique(error: unknown): boolean {
  const e = error as { code?: string; driverError?: { code?: string } };
  return (e.code ?? e.driverError?.code) === '23505';
}
```

- [ ] `tsc --noEmit` → sin errores.
- [ ] **Commit** — `feat(votaciones): repository con opciones fijas y voto único` (porqué: el UNIQUE de la base es el que garantiza un voto por unidad aunque lleguen dos a la vez).

---

### Task 5: Service (TDD)

- [ ] **Step 1: tests que fallan**

Archivo: `apps/backend/src/modules/votaciones/votaciones.service.spec.ts`
```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { Notificador } from '../../core/notificaciones/notificador';
import {
  Asamblea,
  EstadoAsamblea,
  EstadoAsistencia,
  EstadoVotacion,
  FormaConteo,
  MayoriaRequerida,
  PadronVotacion,
  PuntoOrdenDia,
  ResultadoVotacion,
  RolUsuario,
  TipoPuntoOrden,
  VinculoUnidad,
  Votacion,
  Voto,
} from '../../database/entities';
import type { ArchivosService } from '../archivos/archivos.service';
import type { UsuarioActual } from '../auth/auth.types';
import type { ConsorciosService } from '../consorcios/consorcios.service';
import type { ExpensasService } from '../expensas/expensas.service';
import type { UnidadParaPadron } from './padron';
import type { VotacionesRepository } from './votaciones.repository';
import { VotacionesService } from './votaciones.service';

const admin: UsuarioActual = { id: 'a1', email: 'a@x', rol: RolUsuario.ADMINISTRADOR };
const p1: UsuarioActual = { id: 'p1', email: 'p1@x', rol: RolUsuario.VECINO };
const inquilino: UsuarioActual = { id: 'i2', email: 'i2@x', rol: RolUsuario.VECINO };

const HORA = 3600 * 1000;
const enHoras = (h: number) => new Date(Date.now() + h * HORA);

const OPCIONES = [
  { id: 'si', etiqueta: 'A favor', orden: 1, esFija: true },
  { id: 'no', etiqueta: 'En contra', orden: 2, esFija: true },
  { id: 'abs', etiqueta: 'Abstención', orden: 3, esFija: false },
];

/** Independiente, abierta desde hace una hora y por una hora más. */
const votacion = (over: Partial<Votacion> = {}) =>
  ({
    id: 'vt1',
    consorcioId: 'c1',
    asambleaId: null,
    asamblea: null,
    puntoOrdenDiaId: null,
    titulo: 'Bomba de agua',
    padron: PadronVotacion.SOLO_PROPIETARIOS,
    formaConteo: FormaConteo.POR_COEFICIENTE,
    mayoria: MayoriaRequerida.SIMPLE_PRESENTES,
    desempate: 'RECHAZADA',
    permiteVotoAnticipado: false,
    mostrarParcial: false,
    bloqueaConDeuda: false,
    apertura: enHoras(-1),
    cierre: enHoras(1),
    estado: EstadoVotacion.ABIERTA,
    resultado: null,
    opcionVotos: OPCIONES,
    ...over,
  }) as unknown as Votacion;

const deAsamblea = (estadoAsamblea: EstadoAsamblea, over: Partial<Votacion> = {}) =>
  votacion({
    asambleaId: 'as1',
    asamblea: { id: 'as1', estado: estadoAsamblea, quorumRequerido: 60 } as Asamblea,
    puntoOrdenDiaId: 'pt1',
    ...over,
  });

const UNIDADES: UnidadParaPadron[] = [
  { unidadId: 'u1', etiqueta: '1A', coeficiente: 60, vinculos: [{ usuarioId: 'p1', vinculo: VinculoUnidad.PROPIETARIO }] },
  {
    unidadId: 'u2',
    etiqueta: '1B',
    coeficiente: 40,
    vinculos: [
      { usuarioId: 'p2', vinculo: VinculoUnidad.PROPIETARIO },
      { usuarioId: 'i2', vinculo: VinculoUnidad.INQUILINO },
    ],
  },
];

function crearService(
  opts: {
    votacion?: Votacion | null;
    votos?: Partial<Voto>[];
    punto?: PuntoOrdenDia | null;
    puntoTieneVotacion?: boolean;
    conDeuda?: boolean;
    vencidas?: Votacion[];
    choque?: boolean;
    asistencias?: { estado: EstadoAsistencia; coeficienteAplicado: number }[];
  } = {},
) {
  const escrito = {
    creada: null as unknown,
    extras: null as unknown,
    actualizada: [] as unknown[],
    votos: [] as Partial<Voto>[],
  };
  const votos = opts.votos ?? [];
  const repo = {
    listar: async () => [],
    findById: async () => (opts.votacion === undefined ? votacion() : opts.votacion),
    abiertasVencidas: async () => opts.vencidas ?? [],
    abiertas: async () => [],
    findPunto: async () => opts.punto ?? null,
    puntoTieneVotacion: async () => opts.puntoTieneVotacion ?? false,
    crear: async (datos: unknown, extras: unknown) => {
      escrito.creada = datos;
      escrito.extras = extras;
      return 'vt1';
    },
    actualizar: async (_id: string, cambios: unknown) => {
      escrito.actualizada.push(cambios);
    },
    reemplazarOpciones: async () => undefined,
    eliminar: async () => undefined,
    votosDe: async () => votos,
    findVoto: async (_v: string, unidadId: string) => votos.find((x) => x.unidadId === unidadId) ?? null,
    crearVoto: async (datos: Partial<Voto>) => {
      if (opts.choque) return null;
      escrito.votos.push(datos);
      return { id: 'vo1', ...datos };
    },
    unidadesParaPadron: async () => UNIDADES,
    asistenciasDe: async () => opts.asistencias ?? [],
    consorciosDelUsuario: async () => ['c1'],
    vecinosDelConsorcio: async () => ['p1', 'p2'],
  } as unknown as VotacionesRepository;

  const service = new VotacionesService(
    repo,
    { findOne: async () => ({ id: 'c1' }) } as unknown as ConsorciosService,
    { tieneDeudaVencida: async () => opts.conDeuda ?? false } as unknown as ExpensasService,
    {
      exigirPropia: (url: string) => {
        if (!url.startsWith('https://storage/votaciones/')) throw new BadRequestException('ajena');
      },
    } as unknown as ArchivosService,
    { enviar: async () => undefined } as unknown as Notificador,
  );
  return { service, escrito };
}

const independiente = (over = {}) => ({
  consorcioId: 'c1',
  titulo: 'Bomba de agua',
  apertura: enHoras(1).toISOString(),
  cierre: enHoras(48).toISOString(),
  ...over,
});

describe('VotacionesService — alta', () => {
  it('una independiente necesita apertura y cierre', async () => {
    const { service } = crearService();
    await assert.rejects(
      service.crear(admin, independiente({ apertura: undefined })),
      BadRequestException,
    );
  });

  it('el cierre tiene que ser posterior a la apertura', async () => {
    const { service } = crearService();
    await assert.rejects(
      service.crear(admin, independiente({ cierre: enHoras(0.5).toISOString() })),
      BadRequestException,
    );
  });

  it('el punto tiene que ser CON_VOTACION', async () => {
    const { service } = crearService({
      punto: {
        id: 'pt1',
        tipo: TipoPuntoOrden.INFORMATIVO,
        asambleaId: 'as1',
        asamblea: { consorcioId: 'c1', estado: EstadoAsamblea.CONVOCADA, fechaHora: enHoras(24) },
      } as unknown as PuntoOrdenDia,
    });
    await assert.rejects(
      service.crear(admin, { consorcioId: 'c1', titulo: 'X', puntoOrdenDiaId: 'pt1' }),
      BadRequestException,
    );
  });

  it('un punto no puede tener dos votaciones', async () => {
    const { service } = crearService({
      punto: {
        id: 'pt1',
        tipo: TipoPuntoOrden.CON_VOTACION,
        asambleaId: 'as1',
        asamblea: { consorcioId: 'c1', estado: EstadoAsamblea.CONVOCADA, fechaHora: enHoras(24) },
      } as unknown as PuntoOrdenDia,
      puntoTieneVotacion: true,
    });
    await assert.rejects(
      service.crear(admin, { consorcioId: 'c1', titulo: 'X', puntoOrdenDiaId: 'pt1' }),
      ConflictException,
    );
  });

  it('de asamblea toma la hora de la asamblea si no se indica', async () => {
    const fechaHora = enHoras(24);
    const { service, escrito } = crearService({
      punto: {
        id: 'pt1',
        tipo: TipoPuntoOrden.CON_VOTACION,
        asambleaId: 'as1',
        asamblea: { consorcioId: 'c1', estado: EstadoAsamblea.CONVOCADA, fechaHora },
      } as unknown as PuntoOrdenDia,
    });
    await service.crear(admin, { consorcioId: 'c1', titulo: 'X', puntoOrdenDiaId: 'pt1' });
    const creada = escrito.creada as Votacion;
    assert.equal(creada.asambleaId, 'as1');
    assert.equal(creada.apertura.getTime(), fechaHora.getTime());
    assert.equal(creada.cierre.getTime(), fechaHora.getTime() + 3 * HORA);
  });

  it('el adjunto tiene que venir de archivos', async () => {
    const { service } = crearService();
    await assert.rejects(
      service.crear(admin, independiente({ adjuntoUrl: 'https://otro.com/p.pdf' })),
      BadRequestException,
    );
  });

  it('las opciones extra no pueden repetir ni pisar las fijas', async () => {
    const { service } = crearService();
    await assert.rejects(
      service.crear(admin, independiente({ opciones: ['a favor'] })),
      BadRequestException,
    );
    await assert.rejects(
      service.crear(admin, independiente({ opciones: ['Abstención', 'abstención'] })),
      BadRequestException,
    );
  });

  it('pasa las extras al repository', async () => {
    const { service, escrito } = crearService();
    await service.crear(admin, independiente({ opciones: ['Abstención'] }));
    assert.deepEqual(escrito.extras, ['Abstención']);
  });
});

describe('VotacionesService — ciclo', () => {
  it('sólo se edita en borrador', async () => {
    const { service } = crearService();
    await assert.rejects(service.editar(admin, 'vt1', { titulo: 'Y' }), ConflictException);
  });

  it('no se publica una independiente con el cierre pasado', async () => {
    const { service } = crearService({
      votacion: votacion({ estado: EstadoVotacion.BORRADOR, apertura: enHoras(-3), cierre: enHoras(-1) }),
    });
    await assert.rejects(service.publicar(admin, 'vt1'), BadRequestException);
  });

  it('no se publica una de asamblea cerrada', async () => {
    const { service } = crearService({
      votacion: deAsamblea(EstadoAsamblea.CERRADA, { estado: EstadoVotacion.BORRADOR }),
    });
    await assert.rejects(service.publicar(admin, 'vt1'), ConflictException);
  });

  it('cerrar guarda el resultado del escrutinio', async () => {
    const { service, escrito } = crearService({
      votos: [{ unidadId: 'u1', opcionId: 'si', coeficienteAplicado: 60 }],
    });
    await service.cerrar(admin, 'vt1');
    assert.deepEqual(escrito.actualizada[0], {
      estado: EstadoVotacion.CERRADA,
      resultado: ResultadoVotacion.APROBADA,
    });
  });

  it('de asamblea sin quórum cierra SIN_QUORUM', async () => {
    const { service, escrito } = crearService({
      votacion: deAsamblea(EstadoAsamblea.EN_CURSO),
      votos: [{ unidadId: 'u1', opcionId: 'si', coeficienteAplicado: 60 }],
      asistencias: [
        { estado: EstadoAsistencia.ASISTE, coeficienteAplicado: 30 },
        { estado: EstadoAsistencia.NO_ASISTE, coeficienteAplicado: 70 },
      ],
    });
    await service.cerrar(admin, 'vt1');
    assert.equal((escrito.actualizada[0] as Votacion).resultado, ResultadoVotacion.SIN_QUORUM);
  });

  it('una independiente vencida se cierra sola al consultar', async () => {
    const { service, escrito } = crearService({
      vencidas: [votacion({ cierre: enHoras(-1) })],
    });
    await service.listar(admin, {});
    assert.equal((escrito.actualizada[0] as Votacion).estado, EstadoVotacion.CERRADA);
  });
});

describe('VotacionesService — voto del vecino', () => {
  it('vota por su unidad con el peso del coeficiente', async () => {
    const { service, escrito } = crearService();
    await service.votar(p1, 'vt1', { opcionId: 'si' });
    assert.deepEqual(escrito.votos[0], {
      votacionId: 'vt1',
      unidadId: 'u1',
      opcionId: 'si',
      emitidoPorId: 'p1',
      coeficienteAplicado: 60,
      anticipado: false,
    });
  });

  it('el administrador no vota desde la app', async () => {
    const { service } = crearService();
    await assert.rejects(service.votar(admin, 'vt1', { opcionId: 'si' }), ForbiddenException);
  });

  it('con padrón de propietarios, el inquilino no vota', async () => {
    const { service } = crearService();
    await assert.rejects(service.votar(inquilino, 'vt1', { opcionId: 'si' }), ForbiddenException);
  });

  it('una opción de otra votación es 400', async () => {
    const { service } = crearService();
    await assert.rejects(service.votar(p1, 'vt1', { opcionId: 'otra' }), BadRequestException);
  });

  it('con deuda vencida y bloqueo, no vota', async () => {
    const { service } = crearService({ votacion: votacion({ bloqueaConDeuda: true }), conDeuda: true });
    await assert.rejects(service.votar(p1, 'vt1', { opcionId: 'si' }), ForbiddenException);
  });

  it('antes de la apertura es 409', async () => {
    const { service } = crearService({ votacion: votacion({ apertura: enHoras(1), cierre: enHoras(2) }) });
    await assert.rejects(service.votar(p1, 'vt1', { opcionId: 'si' }), ConflictException);
  });

  it('si la administración ya cargó su voto, 409 y lo dice', async () => {
    const { service } = crearService({
      votos: [
        {
          unidadId: 'u1',
          opcionId: 'no',
          coeficienteAplicado: 60,
          createdAt: new Date(),
          emitidoPor: { id: 'a1', rol: RolUsuario.ADMINISTRADOR } as Voto['emitidoPor'],
        },
      ],
    });
    await assert.rejects(service.votar(p1, 'vt1', { opcionId: 'si' }), /administración/);
  });

  it('si dos votos llegan a la vez, el segundo es 409', async () => {
    const { service } = crearService({ choque: true });
    await assert.rejects(service.votar(p1, 'vt1', { opcionId: 'si' }), ConflictException);
  });

  it('de asamblea convocada sin voto anticipado, todavía no se vota', async () => {
    const { service } = crearService({ votacion: deAsamblea(EstadoAsamblea.CONVOCADA) });
    await assert.rejects(service.votar(p1, 'vt1', { opcionId: 'si' }), ConflictException);
  });

  it('con voto anticipado, vota antes y queda marcado', async () => {
    const { service, escrito } = crearService({
      votacion: deAsamblea(EstadoAsamblea.CONVOCADA, { permiteVotoAnticipado: true }),
    });
    await service.votar(p1, 'vt1', { opcionId: 'si' });
    assert.equal(escrito.votos[0].anticipado, true);
  });
});

describe('VotacionesService — voto presencial', () => {
  it('lo carga el admin con la asamblea en curso', async () => {
    const { service, escrito } = crearService({ votacion: deAsamblea(EstadoAsamblea.EN_CURSO) });
    await service.votarPresencial(admin, 'vt1', 'u2', { opcionId: 'no' });
    assert.equal(escrito.votos[0].emitidoPorId, 'a1');
    assert.equal(escrito.votos[0].coeficienteAplicado, 40);
  });

  it('una independiente no tiene voto presencial', async () => {
    const { service } = crearService();
    await assert.rejects(
      service.votarPresencial(admin, 'vt1', 'u2', { opcionId: 'no' }),
      BadRequestException,
    );
  });

  it('una unidad fuera del padrón es 400', async () => {
    const { service } = crearService({ votacion: deAsamblea(EstadoAsamblea.EN_CURSO) });
    await assert.rejects(
      service.votarPresencial(admin, 'vt1', 'u9', { opcionId: 'no' }),
      BadRequestException,
    );
  });

  it('si el vecino ya votó desde la app, 409', async () => {
    const { service } = crearService({
      votacion: deAsamblea(EstadoAsamblea.EN_CURSO),
      votos: [
        {
          unidadId: 'u2',
          opcionId: 'si',
          coeficienteAplicado: 40,
          createdAt: new Date(),
          emitidoPor: { id: 'p2', rol: RolUsuario.VECINO } as Voto['emitidoPor'],
        },
      ],
    });
    await assert.rejects(
      service.votarPresencial(admin, 'vt1', 'u2', { opcionId: 'no' }),
      /desde la app/,
    );
  });
});

describe('VotacionesService — visibilidad', () => {
  it('el vecino no ve borradores', async () => {
    const { service } = crearService({ votacion: votacion({ estado: EstadoVotacion.BORRADOR }) });
    await assert.rejects(service.findOne(p1, 'vt1'), NotFoundException);
  });

  it('sin mostrar parcial, el vecino no ve el conteo mientras está abierta', async () => {
    const { service } = crearService();
    const detalle = await service.findOne(p1, 'vt1');
    assert.equal(detalle.escrutinio, null);
  });

  it('cerrada, el vecino ve el conteo', async () => {
    const { service } = crearService({ votacion: votacion({ estado: EstadoVotacion.CERRADA }) });
    const detalle = await service.findOne(p1, 'vt1');
    assert.notEqual(detalle.escrutinio, null);
  });

  it('el vecino ve cuánto pesa su voto', async () => {
    const { service } = crearService();
    const detalle = (await service.findOne(p1, 'vt1')) as { misUnidades: { pesoPorcentaje: number }[] };
    assert.equal(detalle.misUnidades[0].pesoPorcentaje, 60);
  });
});
```

- [ ] **Step 2:** correr → FAIL (`Cannot find module './votaciones.service'`).

- [ ] **Step 3: implementar**

Archivo: `apps/backend/src/modules/votaciones/votaciones.service.ts`
```ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Notificador } from '../../core/notificaciones/notificador';
import {
  EstadoAsamblea,
  EstadoVotacion,
  ResultadoVotacion,
  RolUsuario,
  TipoPuntoOrden,
  Votacion,
  Voto,
} from '../../database/entities';
import { ArchivosService } from '../archivos/archivos.service';
import { DestinoArchivo } from '../archivos/tipos-archivo';
import { calcularQuorum } from '../asambleas/quorum';
import type { UsuarioActual } from '../auth/auth.types';
import { ConsorciosService } from '../consorcios/consorcios.service';
import { ExpensasService } from '../expensas/expensas.service';
import { CreateVotacionDto } from './dto/create-votacion.dto';
import { ListarVotacionesQuery } from './dto/listar-votaciones.query';
import { ReemplazarOpcionesDto } from './dto/reemplazar-opciones.dto';
import { UpdateVotacionDto } from './dto/update-votacion.dto';
import { VotarDto } from './dto/votar.dto';
import { VotoPresencialDto } from './dto/voto-presencial.dto';
import { escrutar, type Escrutinio } from './escrutinio';
import { armarPadron, pesoTotal, type UnidadHabilitada } from './padron';
import { ETIQUETA_A_FAVOR, ETIQUETA_EN_CONTRA, VotacionesRepository } from './votaciones.repository';

const esAdmin = (usuario: UsuarioActual) =>
  usuario.rol === RolUsuario.ADMINISTRADOR || usuario.rol === RolUsuario.SUPER_ADMIN;

/** Si una votación de asamblea no dice cuánto dura, se toma la asamblea entera. */
const HORAS_POR_DEFECTO = 3;
const HORA_MS = 3600 * 1000;

const ASAMBLEA_CERRADA = [EstadoAsamblea.CERRADA, EstadoAsamblea.CERRADA_SIN_QUORUM];

const r2 = (n: number) => Math.round(n * 100) / 100;

type Canal = 'app' | 'presencial';

/** Lo que se muestra de un voto: nunca la entidad `Usuario` entera (trae el hash). */
function vistaVoto(voto: Voto) {
  return {
    unidadId: voto.unidadId,
    opcionId: voto.opcionId,
    anticipado: voto.anticipado,
    createdAt: voto.createdAt,
    emitidoPor: voto.emitidoPor
      ? { id: voto.emitidoPor.id, nombre: voto.emitidoPor.nombre, apellido: voto.emitidoPor.apellido }
      : { id: voto.emitidoPorId },
    cargadoPorLaAdministracion: voto.emitidoPor ? voto.emitidoPor.rol !== RolUsuario.VECINO : false,
  };
}

@Injectable()
export class VotacionesService {
  private readonly logger = new Logger(VotacionesService.name);

  constructor(
    private readonly votaciones: VotacionesRepository,
    private readonly consorcios: ConsorciosService,
    private readonly expensas: ExpensasService,
    private readonly archivos: ArchivosService,
    private readonly notificador: Notificador,
  ) {}

  // ── Consultas ──────────────────────────────────────────────────────────────

  async listar(usuario: UsuarioActual, query: ListarVotacionesQuery) {
    await this.cerrarVencidas();
    const filtro = esAdmin(usuario)
      ? { ocultarBorradores: false }
      : { consorcioIds: await this.votaciones.consorciosDelUsuario(usuario.id), ocultarBorradores: true };
    return this.votaciones.listar(query, filtro);
  }

  async findOne(usuario: UsuarioActual, id: string) {
    await this.cerrarVencidas();
    const votacion = await this.buscarConPermiso(usuario, id);
    const { padron, votos, escrutinio } = await this.contar(votacion);
    const total = pesoTotal(padron);

    if (esAdmin(usuario)) {
      return {
        ...votacion,
        padron: { unidades: padron.size, pesoTotal: total },
        escrutinio,
      };
    }

    const misUnidades = [...padron.values()]
      .filter((u) => u.votantes.includes(usuario.id))
      .map((u) => {
        const voto = votos.find((v) => v.unidadId === u.unidadId);
        return {
          unidadId: u.unidadId,
          etiqueta: u.etiqueta,
          // "Tu voto vale 1,74%": sobre el padrón, no sobre lo emitido.
          pesoPorcentaje: total > 0 ? r2((u.peso / total) * 100) : 0,
          voto: voto ? vistaVoto(voto) : null,
        };
      });
    const verParcial = votacion.mostrarParcial || votacion.estado === EstadoVotacion.CERRADA;
    return { ...votacion, misUnidades, escrutinio: verParcial ? escrutinio : null };
  }

  /** El padrón con quién votó y por qué canal: para que el admin sepa a quién le falta. */
  async padronConVotos(id: string) {
    await this.cerrarVencidas();
    const votacion = await this.exigirVotacion(id);
    const { padron, votos } = await this.contar(votacion);
    return [...padron.values()].map((u) => {
      const voto = votos.find((v) => v.unidadId === u.unidadId);
      return { unidadId: u.unidadId, etiqueta: u.etiqueta, peso: u.peso, voto: voto ? vistaVoto(voto) : null };
    });
  }

  /** Para el inicio del vecino. */
  async abiertasDelVecino(usuario: UsuarioActual): Promise<Votacion[]> {
    await this.cerrarVencidas();
    const consorcioIds = await this.votaciones.consorciosDelUsuario(usuario.id);
    if (consorcioIds.length === 0) return [];
    return this.votaciones.abiertas(consorcioIds);
  }

  // ── ABM ────────────────────────────────────────────────────────────────────

  async crear(usuario: UsuarioActual, dto: CreateVotacionDto) {
    let asambleaId: string | null = null;
    let apertura = dto.apertura ? new Date(dto.apertura) : undefined;
    let cierre = dto.cierre ? new Date(dto.cierre) : undefined;

    if (dto.puntoOrdenDiaId) {
      const punto = await this.votaciones.findPunto(dto.puntoOrdenDiaId);
      if (!punto) throw new BadRequestException('Ese punto del orden del día no existe');
      if (punto.tipo !== TipoPuntoOrden.CON_VOTACION) {
        throw new BadRequestException('El punto no es CON_VOTACION: no se vota');
      }
      if (punto.asamblea.consorcioId !== dto.consorcioId) {
        throw new BadRequestException('El punto es de una asamblea de otro consorcio');
      }
      if (ASAMBLEA_CERRADA.includes(punto.asamblea.estado)) {
        throw new ConflictException('La asamblea ya está cerrada');
      }
      if (await this.votaciones.puntoTieneVotacion(punto.id)) {
        throw new ConflictException('Ese punto del orden del día ya tiene su votación');
      }
      asambleaId = punto.asambleaId;
      apertura ??= punto.asamblea.fechaHora;
      cierre ??= new Date(apertura.getTime() + HORAS_POR_DEFECTO * HORA_MS);
    } else {
      // 404 si el consorcio no existe.
      await this.consorcios.findOne(dto.consorcioId);
      if (!apertura || !cierre) {
        throw new BadRequestException('Una votación independiente necesita apertura y cierre');
      }
    }

    exigirVentana(apertura, cierre);
    const extras = exigirExtrasValidas(dto.opciones ?? []);
    if (dto.adjuntoUrl) this.archivos.exigirPropia(dto.adjuntoUrl, DestinoArchivo.VOTACIONES);

    const id = await this.votaciones.crear(
      {
        consorcioId: dto.consorcioId,
        asambleaId,
        puntoOrdenDiaId: dto.puntoOrdenDiaId ?? null,
        titulo: dto.titulo,
        descripcion: dto.descripcion ?? null,
        adjuntoUrl: dto.adjuntoUrl ?? null,
        padron: dto.padron,
        formaConteo: dto.formaConteo,
        mayoria: dto.mayoria,
        desempate: dto.desempate,
        permiteVotoAnticipado: dto.permiteVotoAnticipado,
        mostrarParcial: dto.mostrarParcial,
        bloqueaConDeuda: dto.bloqueaConDeuda,
        apertura,
        cierre,
      },
      extras,
    );
    return this.findOne(usuario, id);
  }

  async editar(usuario: UsuarioActual, id: string, dto: UpdateVotacionDto) {
    const votacion = await this.exigirVotacion(id);
    exigirEstado(votacion, [EstadoVotacion.BORRADOR], 'editar');

    const apertura = dto.apertura ? new Date(dto.apertura) : votacion.apertura;
    const cierre = dto.cierre ? new Date(dto.cierre) : votacion.cierre;
    exigirVentana(apertura, cierre);
    if (dto.adjuntoUrl && dto.adjuntoUrl !== votacion.adjuntoUrl) {
      this.archivos.exigirPropia(dto.adjuntoUrl, DestinoArchivo.VOTACIONES);
    }

    const { apertura: _a, cierre: _c, ...resto } = dto;
    await this.votaciones.actualizar(id, { ...resto, apertura, cierre });
    return this.findOne(usuario, id);
  }

  async reemplazarOpciones(usuario: UsuarioActual, id: string, dto: ReemplazarOpcionesDto) {
    const votacion = await this.exigirVotacion(id);
    exigirEstado(votacion, [EstadoVotacion.BORRADOR], 'cambiar las opciones de');
    await this.votaciones.reemplazarOpciones(id, exigirExtrasValidas(dto.opciones));
    return this.findOne(usuario, id);
  }

  async eliminar(id: string): Promise<void> {
    const votacion = await this.exigirVotacion(id);
    exigirEstado(votacion, [EstadoVotacion.BORRADOR], 'eliminar');
    await this.votaciones.eliminar(id);
  }

  // ── Ciclo ──────────────────────────────────────────────────────────────────

  async publicar(usuario: UsuarioActual, id: string) {
    const votacion = await this.exigirVotacion(id);
    exigirEstado(votacion, [EstadoVotacion.BORRADOR], 'publicar');

    if (votacion.asamblea) {
      if (![EstadoAsamblea.CONVOCADA, EstadoAsamblea.EN_CURSO].includes(votacion.asamblea.estado)) {
        throw new ConflictException('Se publica con la asamblea convocada o en curso');
      }
    } else if (votacion.cierre.getTime() <= Date.now()) {
      throw new BadRequestException('El cierre ya pasó: corregilo antes de publicar');
    }

    await this.votaciones.actualizar(id, { estado: EstadoVotacion.ABIERTA });
    await this.avisarPublicacion(votacion);
    return this.findOne(usuario, id);
  }

  async cerrar(usuario: UsuarioActual, id: string) {
    const votacion = await this.exigirVotacion(id);
    exigirEstado(votacion, [EstadoVotacion.ABIERTA], 'cerrar');
    await this.cerrarVotacion(votacion);
    return this.findOne(usuario, id);
  }

  // ── Votos ──────────────────────────────────────────────────────────────────

  async votar(usuario: UsuarioActual, id: string, dto: VotarDto) {
    if (esAdmin(usuario)) {
      throw new ForbiddenException('La administración carga votos presenciales, por unidad');
    }
    await this.cerrarVencidas();
    const votacion = await this.buscarConPermiso(usuario, id);
    const { anticipado } = exigirQueAcepteVotos(votacion, 'app');

    const padron = await this.padronDe(votacion);
    const mias = [...padron.values()].filter((u) => u.votantes.includes(usuario.id));
    const unidad = elegirUnidad(mias, dto.unidadId);
    return this.emitir(votacion, unidad, dto.opcionId, usuario, anticipado);
  }

  async votarPresencial(usuario: UsuarioActual, id: string, unidadId: string, dto: VotoPresencialDto) {
    await this.cerrarVencidas();
    const votacion = await this.exigirVotacion(id);
    exigirQueAcepteVotos(votacion, 'presencial');

    const unidad = (await this.padronDe(votacion)).get(unidadId);
    if (!unidad) throw new BadRequestException('Esa unidad no está en el padrón de esta votación');
    return this.emitir(votacion, unidad, dto.opcionId, usuario, false);
  }

  // ── Privados ───────────────────────────────────────────────────────────────

  private async emitir(
    votacion: Votacion,
    unidad: UnidadHabilitada,
    opcionId: string,
    usuario: UsuarioActual,
    anticipado: boolean,
  ) {
    if (!votacion.opcionVotos?.some((o) => o.id === opcionId)) {
      throw new BadRequestException('Esa opción no es de esta votación');
    }
    if (votacion.bloqueaConDeuda && (await this.expensas.tieneDeudaVencida(unidad.unidadId))) {
      throw new ForbiddenException('La unidad tiene expensas vencidas: no puede votar en esta votación');
    }

    const previo = await this.votaciones.findVoto(votacion.id, unidad.unidadId);
    if (previo) throw yaVoto(unidad, previo);

    const voto = await this.votaciones.crearVoto({
      votacionId: votacion.id,
      unidadId: unidad.unidadId,
      opcionId,
      emitidoPorId: usuario.id,
      coeficienteAplicado: unidad.peso,
      anticipado,
    });
    // Otro voto de la misma unidad entró entre el chequeo y el INSERT.
    if (!voto) throw yaVoto(unidad, await this.votaciones.findVoto(votacion.id, unidad.unidadId));
    return vistaVoto(voto);
  }

  private async padronDe(votacion: Votacion) {
    const unidades = await this.votaciones.unidadesParaPadron(votacion.consorcioId);
    return armarPadron(unidades, votacion.padron, votacion.formaConteo);
  }

  private async contar(
    votacion: Votacion,
    sinQuorum = false,
  ): Promise<{ padron: Map<string, UnidadHabilitada>; votos: Voto[]; escrutinio: Escrutinio }> {
    const padron = await this.padronDe(votacion);
    const votos = await this.votaciones.votosDe(votacion.id);
    const opciones = votacion.opcionVotos ?? [];
    const fija = (etiqueta: string) => opciones.find((o) => o.esFija && o.etiqueta === etiqueta)?.id ?? '';

    const escrutinio = escrutar(
      opciones.map((o) => ({ id: o.id, etiqueta: o.etiqueta })),
      votos.map((v) => ({ opcionId: v.opcionId, peso: v.coeficienteAplicado })),
      {
        mayoria: votacion.mayoria,
        desempate: votacion.desempate,
        aFavorId: fija(ETIQUETA_A_FAVOR),
        enContraId: fija(ETIQUETA_EN_CONTRA),
        pesoPadron: pesoTotal(padron),
        sinQuorum,
      },
    );
    return { padron, votos, escrutinio };
  }

  /** Una de asamblea sin quórum en la asamblea no decide nada: queda SIN_QUORUM. */
  private async cerrarVotacion(votacion: Votacion): Promise<ResultadoVotacion> {
    let sinQuorum = false;
    if (votacion.asambleaId && votacion.asamblea) {
      const asistencias = await this.votaciones.asistenciasDe(votacion.asambleaId);
      sinQuorum = !calcularQuorum(asistencias, votacion.asamblea.quorumRequerido).alcanzado;
    }
    const { escrutinio } = await this.contar(votacion, sinQuorum);
    await this.votaciones.actualizar(votacion.id, {
      estado: EstadoVotacion.CERRADA,
      resultado: escrutinio.resultado,
    });
    return escrutinio.resultado;
  }

  /** Sin cron: cada consulta cierra las independientes que ya pasaron su cierre. */
  private async cerrarVencidas(): Promise<void> {
    for (const votacion of await this.votaciones.abiertasVencidas()) {
      await this.cerrarVotacion(votacion);
    }
  }

  private async exigirVotacion(id: string): Promise<Votacion> {
    const votacion = await this.votaciones.findById(id);
    if (!votacion) throw new NotFoundException(`La votación ${id} no existe`);
    return votacion;
  }

  /** Al vecino, 404 y no 403 para lo que no puede ver: un 403 confirmaría que existe. */
  private async buscarConPermiso(usuario: UsuarioActual, id: string): Promise<Votacion> {
    const votacion = await this.exigirVotacion(id);
    if (esAdmin(usuario)) return votacion;

    const consorcios = await this.votaciones.consorciosDelUsuario(usuario.id);
    if (votacion.estado === EstadoVotacion.BORRADOR || !consorcios.includes(votacion.consorcioId)) {
      throw new NotFoundException(`La votación ${id} no existe`);
    }
    return votacion;
  }

  /** Nunca corta la operación: si el aviso falla, la votación ya quedó publicada. */
  private async avisarPublicacion(votacion: Votacion) {
    try {
      const vecinos = await this.votaciones.vecinosDelConsorcio(votacion.consorcioId);
      const cierre = votacion.cierre.toLocaleString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
      });
      await Promise.allSettled(
        vecinos.map((destinatarioId) =>
          this.notificador.enviar({
            destinatarioId,
            asunto: `Nueva votación: ${votacion.titulo}`,
            cuerpo: `Se abrió la votación "${votacion.titulo}". Cierra el ${cierre}.`,
            origen: `votacion:${votacion.id}`,
          }),
        ),
      );
    } catch (error) {
      this.logger.warn(`No se pudo avisar la votación ${votacion.id}: ${String(error)}`);
    }
  }
}

function exigirEstado(votacion: Votacion, permitidos: EstadoVotacion[], accion: string) {
  if (!permitidos.includes(votacion.estado)) {
    throw new ConflictException(`No se puede ${accion} una votación en estado ${votacion.estado}`);
  }
}

function exigirVentana(apertura: Date, cierre: Date) {
  if (Number.isNaN(apertura.getTime()) || Number.isNaN(cierre.getTime())) {
    throw new BadRequestException('Apertura y cierre tienen que ser fechas válidas');
  }
  if (cierre.getTime() <= apertura.getTime()) {
    throw new BadRequestException('El cierre tiene que ser posterior a la apertura');
  }
}

/** Sin repetidas, y ninguna que se haga pasar por "A favor" o "En contra". */
function exigirExtrasValidas(extras: string[]): string[] {
  const limpias = extras.map((e) => e.trim());
  const vistas = new Set([ETIQUETA_A_FAVOR.toLowerCase(), ETIQUETA_EN_CONTRA.toLowerCase()]);
  for (const etiqueta of limpias) {
    const clave = etiqueta.toLowerCase();
    if (vistas.has(clave)) {
      throw new BadRequestException(`La opción "${etiqueta}" está repetida o es una de las fijas`);
    }
    vistas.add(clave);
  }
  return limpias;
}

/**
 * Cuándo se acepta un voto. Independiente: entre apertura y cierre, sólo desde
 * la app. De asamblea: con la asamblea en curso; desde la app también antes,
 * si la votación permite voto anticipado.
 */
function exigirQueAcepteVotos(votacion: Votacion, canal: Canal): { anticipado: boolean } {
  if (votacion.estado !== EstadoVotacion.ABIERTA) {
    throw new ConflictException('La votación no está abierta');
  }

  if (!votacion.asambleaId) {
    if (canal === 'presencial') {
      throw new BadRequestException('Una votación independiente se vota sólo desde la app');
    }
    const ahora = Date.now();
    if (ahora < votacion.apertura.getTime()) throw new ConflictException('La votación todavía no abrió');
    if (ahora >= votacion.cierre.getTime()) throw new ConflictException('La votación ya cerró');
    return { anticipado: false };
  }

  const estado = votacion.asamblea?.estado;
  if (estado === EstadoAsamblea.EN_CURSO) return { anticipado: false };
  if (canal === 'app' && votacion.permiteVotoAnticipado && estado === EstadoAsamblea.CONVOCADA) {
    return { anticipado: true };
  }
  throw new ConflictException('Esta votación se vota durante la asamblea');
}

function elegirUnidad(mias: UnidadHabilitada[], pedida?: string): UnidadHabilitada {
  if (mias.length === 0) {
    throw new ForbiddenException('No estás habilitado para votar en esta votación');
  }
  if (pedida) {
    const unidad = mias.find((u) => u.unidadId === pedida);
    if (!unidad) throw new ForbiddenException('No podés votar por esa unidad');
    return unidad;
  }
  if (mias.length > 1) {
    throw new BadRequestException('Votás por más de una unidad: indicá por cuál');
  }
  return mias[0];
}

function yaVoto(unidad: UnidadHabilitada, voto: Voto | null): ConflictException {
  if (!voto) return new ConflictException(`La unidad ${unidad.etiqueta} ya votó`);
  const cuando = voto.createdAt.toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
  });
  const canal =
    voto.emitidoPor && voto.emitidoPor.rol !== RolUsuario.VECINO
      ? 'lo cargó la administración'
      : 'desde la app';
  return new ConflictException(`La unidad ${unidad.etiqueta} ya votó el ${cuando} (${canal})`);
}
```

- [ ] **Step 4:** correr → PASS. `tsc --noEmit` → sin errores.
- [ ] **Step 5: commit** — `feat(votaciones): voto desde la app y presencial, cierre y visibilidad` (porqué: una unidad vota una vez y el error dice quién ya votó, así el admin no carga encima del vecino ni al revés).

---

### Task 6: Controller, módulo y registro

Archivo: `apps/backend/src/modules/votaciones/votaciones.controller.ts`
```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '../../database/entities';
import type { UsuarioActual as Usuario } from '../auth/auth.types';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import { CreateVotacionDto } from './dto/create-votacion.dto';
import { ListarVotacionesQuery } from './dto/listar-votaciones.query';
import { ReemplazarOpcionesDto } from './dto/reemplazar-opciones.dto';
import { UpdateVotacionDto } from './dto/update-votacion.dto';
import { VotarDto } from './dto/votar.dto';
import { VotoPresencialDto } from './dto/voto-presencial.dto';
import { VotacionesService } from './votaciones.service';

/**
 * Un solo controller para los dos portales: el vecino vota desde la app y la
 * administración carga los votos presenciales de una asamblea.
 */
@ApiTags('votaciones')
@ApiBearerAuth()
@Controller('votaciones')
export class VotacionesController {
  constructor(private readonly votaciones: VotacionesService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista votaciones',
    description: 'El administrador ve todas; el vecino, las publicadas de sus consorcios.',
  })
  listar(@UsuarioActual() usuario: Usuario, @Query() query: ListarVotacionesQuery) {
    return this.votaciones.listar(usuario, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Detalle con opciones y escrutinio',
    description: 'Al vecino: sus unidades habilitadas, su voto y el parcial sólo si corresponde.',
  })
  @ApiResponse({ status: 404, description: 'No existe o no es visible' })
  findOne(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return this.votaciones.findOne(usuario, id);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Post()
  @ApiOperation({ summary: 'Crea una votación en borrador, independiente o sobre un punto del orden del día' })
  crear(@UsuarioActual() usuario: Usuario, @Body() dto: CreateVotacionDto) {
    return this.votaciones.crear(usuario, dto);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Patch(':id')
  @ApiOperation({ summary: 'Edita una votación en borrador' })
  editar(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVotacionDto,
  ) {
    return this.votaciones.editar(usuario, id, dto);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Elimina una votación en borrador' })
  eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return this.votaciones.eliminar(id);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Put(':id/opciones')
  @ApiOperation({ summary: 'Reemplaza las opciones no fijas (sólo en borrador)' })
  reemplazarOpciones(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReemplazarOpcionesDto,
  ) {
    return this.votaciones.reemplazarOpciones(usuario, id, dto);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Post(':id/publicar')
  @ApiOperation({ summary: 'Abre la votación y avisa a los vecinos' })
  publicar(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return this.votaciones.publicar(usuario, id);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Post(':id/cerrar')
  @ApiOperation({ summary: 'Cierra y guarda el resultado' })
  cerrar(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return this.votaciones.cerrar(usuario, id);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Get(':id/votos')
  @ApiOperation({ summary: 'Padrón con quién votó, qué y por qué canal' })
  padronConVotos(@Param('id', ParseUUIDPipe) id: string) {
    return this.votaciones.padronConVotos(id);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Post(':id/votos/:unidadId')
  @ApiOperation({
    summary: 'Carga el voto presencial de una unidad',
    description: 'Sólo en votaciones de asamblea, con la asamblea en curso. 409 si la unidad ya votó.',
  })
  votarPresencial(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('unidadId', ParseUUIDPipe) unidadId: string,
    @Body() dto: VotoPresencialDto,
  ) {
    return this.votaciones.votarPresencial(usuario, id, unidadId, dto);
  }

  @Roles(RolUsuario.VECINO)
  @Post(':id/votos')
  @ApiOperation({
    summary: 'El vecino vota',
    description: 'Una vez por unidad y sin cambios. 409 si la unidad ya votó, diciendo cuándo y por qué canal.',
  })
  votar(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VotarDto,
  ) {
    return this.votaciones.votar(usuario, id, dto);
  }
}
```

Archivo: `apps/backend/src/modules/votaciones/votaciones.module.ts`
```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Asistencia,
  OpcionVoto,
  PuntoOrdenDia,
  Unidad,
  UnidadUsuario,
  Votacion,
  Voto,
} from '../../database/entities';
import { ArchivosModule } from '../archivos/archivos.module';
import { ConsorciosModule } from '../consorcios/consorcios.module';
import { ExpensasModule } from '../expensas/expensas.module';
import { VotacionesController } from './votaciones.controller';
import { VotacionesRepository } from './votaciones.repository';
import { VotacionesService } from './votaciones.service';

/**
 * No importa AsambleasModule: lee el punto del orden del día y la asistencia
 * por su cuenta. Es asambleas el que pregunta por votaciones (no se cierra
 * con votaciones abiertas), y al revés sería un ciclo.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Votacion,
      OpcionVoto,
      Voto,
      PuntoOrdenDia,
      Asistencia,
      // Para armar el padrón y saber qué consorcios ve cada vecino.
      Unidad,
      UnidadUsuario,
    ]),
    ConsorciosModule,
    // Para `bloquea_con_deuda`.
    ExpensasModule,
    // Para el presupuesto adjunto.
    ArchivosModule,
  ],
  controllers: [VotacionesController],
  providers: [VotacionesService, VotacionesRepository],
  exports: [VotacionesService],
})
export class VotacionesModule {}
```

- [ ] En `src/app.module.ts`: `import { VotacionesModule } from './modules/votaciones/votaciones.module';` y `VotacionesModule,` en `imports` después de `AsambleasModule,` (antes de `InicioModule`).
- [ ] `tsc`, `pnpm test`, `pnpm build` → verdes.
- [ ] **Commit** — `feat(votaciones): endpoints REST para ambos portales`.

---

### Task 7: Asambleas no se cierra con votaciones abiertas

- [ ] **Test** en `asambleas.service.spec.ts`: mock `votacionesAbiertas: async () => opts.votacionesAbiertas ?? 0` y

```ts
it('no se cierra con votaciones abiertas', async () => {
  const { service } = crearService({
    asamblea: asamblea({ estado: EstadoAsamblea.EN_CURSO }),
    votacionesAbiertas: 1,
  });
  await assert.rejects(service.cerrar(admin, 'as1'), /votaciones/);
});
```

- [ ] **Repository** (`asambleas.repository.ts`): inyectar `@InjectRepository(Votacion) private readonly votaciones: Repository<Votacion>` y

```ts
/** Una asamblea no se cierra con votaciones sin resultado. */
votacionesAbiertas(asambleaId: string): Promise<number> {
  return this.votaciones.count({ where: { asambleaId, estado: EstadoVotacion.ABIERTA } });
}
```

- [ ] **Service** (`cerrar`), después de `exigirEstado`:

```ts
if ((await this.asambleas.votacionesAbiertas(id)) > 0) {
  throw new ConflictException('Cerrá primero las votaciones abiertas de esta asamblea');
}
```

- [ ] **Módulo**: sumar `Votacion` a `TypeOrmModule.forFeature`.
- [ ] Tests verdes. **Commit** — `feat(asambleas): no cerrar con votaciones abiertas`.

---

### Task 8: Inicio suma las votaciones abiertas

- [ ] `EventoProximo` suma la variante `{ tipo: 'VOTACION'; id; titulo; fecha /* cierre */; consorcioId; asambleaId: string | null }`.
- [ ] `InicioService` recibe `VotacionesService` (último parámetro) y en `proximosEventos` agrega `this.votaciones.abiertasDelVecino(usuario)` al `Promise.all`, mapeado con `fecha: v.cierre`.
- [ ] `InicioModule` importa `VotacionesModule`.
- [ ] Spec de inicio: pasar el mock `{ abiertasDelVecino: async () => opts.votaciones ?? [] }` y un test que verifique que aparece `['VOTACION', 'vt1', 'Bomba de agua']` ordenado por fecha.
- [ ] Actualizar la descripción de Swagger de `GET /inicio`.
- [ ] **Commit** — `feat(inicio): votaciones abiertas en los próximos eventos`.

---

### Task 9: README

- [ ] Sección `## Votaciones` después de `## Asambleas`: tipos, ciclo, padrón, escrutinio, voto único y canales, endpoints, pendiente (RabbitMQ; el padrón de una votación cerrada se recalcula con las unidades actuales).
- [ ] En `## Asambleas` → Pendiente: sacar "Votaciones". En `## Inicio`: mencionar votaciones en próximos eventos.
- [ ] **Commit** — `docs: sección de votaciones en el README`.

---

### Task 10: Verificación final

- [ ] `pnpm test`, `tsc --noEmit`, `pnpm build` → verdes.
- [ ] `git log main..HEAD`: todos los commits sólo con el autor del repo, sin co-autoría.
- [ ] No mergear ni pushear sin orden explícita.
