# Módulo Asambleas — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el módulo `asambleas` del backend: ABM, orden del día, ciclo de estados, asistencia y quórum en vivo por coeficiente, según [el spec](../specs/2026-10-02-asambleas-design.md).

**Architecture:** Un módulo plano en `apps/backend/src/modules/asambleas/` con controller → service → repository. El cálculo de quórum es una función pura (`quorum.ts`), testeada aparte. Sin cambios de esquema: las entities `Asamblea`, `PuntoOrdenDia` y `Asistencia` ya existen.

**Tech Stack:** NestJS 11, TypeORM 0.3 (Postgres), class-validator/class-transformer, tests con `node:test` + `node:assert/strict`.

**Reglas del repo que aplican:** español en dominio y comentarios, inglés en lo técnico; las entities no se tocan; commits atómicos que expliquen el porqué y **sin líneas de co-autoría**.

**Comandos** (desde `apps/backend`; si `pnpm` no está en el PATH, anteponer `corepack`):
- Tests: `pnpm test` (corre `node --require ts-node/register/transpile-only --test "src/**/*.spec.ts"`).
- Un solo archivo: `node --require ts-node/register/transpile-only --test src/modules/asambleas/quorum.spec.ts`.
- Tipos: `pnpm exec tsc --noEmit -p tsconfig.json`.
- Lint: `pnpm lint` (si existe el script).

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/modules/asambleas/quorum.ts` | crear | Función pura `calcularQuorum` y `porcentajeDeQuorum` |
| `src/modules/asambleas/quorum.spec.ts` | crear | Tests del cálculo |
| `src/modules/asambleas/dto/*.ts` | crear | DTOs de entrada y query |
| `src/modules/asambleas/asambleas.repository.ts` | crear | Acceso a datos y transacciones |
| `src/modules/asambleas/asambleas.service.ts` | crear | Reglas de negocio, permisos, transiciones |
| `src/modules/asambleas/asambleas.service.spec.ts` | crear | Tests del service con repository mockeado |
| `src/modules/asambleas/asambleas.controller.ts` | crear | Rutas REST |
| `src/modules/asambleas/asambleas.module.ts` | crear | Wiring de Nest |
| `src/app.module.ts` | modificar | Registrar `AsambleasModule` |
| `README.md` (raíz) | modificar | Sección "Asambleas" |

---

### Task 0: Dependencias instaladas y baseline verde

- [ ] **Step 1:** Desde la raíz del repo: `corepack pnpm install` (o `pnpm install`).
- [ ] **Step 2:** Desde `apps/backend`: `pnpm test`. Expected: todos los tests existentes PASS.
- [ ] **Step 3:** `pnpm exec tsc --noEmit -p tsconfig.json`. Expected: sin errores.

---

### Task 1: Cálculo de quórum

**Files:**
- Create: `apps/backend/src/modules/asambleas/quorum.ts`
- Test: `apps/backend/src/modules/asambleas/quorum.spec.ts`

- [ ] **Step 1: Escribir el test que falla**

```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EstadoAsistencia } from '../../database/entities';
import { calcularQuorum, porcentajeDeQuorum } from './quorum';

const { ASISTE, NO_ASISTE, SIN_RESPONDER, CON_PODER } = EstadoAsistencia;
const a = (estado: EstadoAsistencia, coeficienteAplicado: number) => ({ estado, coeficienteAplicado });

describe('calcularQuorum', () => {
  it('sin asistencias da 0% y no alcanza', () => {
    const q = calcularQuorum([], 60);
    assert.equal(q.porcentaje, 0);
    assert.equal(q.alcanzado, false);
    assert.equal(q.faltanPuntos, 60);
    assert.equal(q.faltanUnidades, null);
  });

  it('suma ASISTE y CON_PODER; NO_ASISTE y SIN_RESPONDER no suman', () => {
    const q = calcularQuorum(
      [a(ASISTE, 30), a(CON_PODER, 20), a(NO_ASISTE, 25), a(SIN_RESPONDER, 25)],
      60,
    );
    assert.equal(q.porcentaje, 50);
    assert.equal(q.alcanzado, false);
    assert.equal(q.faltanPuntos, 10);
    assert.deepEqual(q.conteo, { ASISTE: 1, NO_ASISTE: 1, SIN_RESPONDER: 1, CON_PODER: 1 });
  });

  it('alcanza cuando el porcentaje iguala al requerido', () => {
    const q = calcularQuorum([a(ASISTE, 60), a(NO_ASISTE, 40)], 60);
    assert.equal(q.alcanzado, true);
    assert.equal(q.faltanPuntos, 0);
    assert.equal(q.faltanUnidades, 0);
  });

  it('redondea a dos decimales', () => {
    const q = calcularQuorum([a(ASISTE, 1), a(SIN_RESPONDER, 1), a(SIN_RESPONDER, 1)], 50);
    assert.equal(q.porcentaje, 33.33);
  });

  it('faltanUnidades toma primero las sin responder de mayor coeficiente', () => {
    const q = calcularQuorum(
      [a(ASISTE, 40), a(SIN_RESPONDER, 5), a(SIN_RESPONDER, 15), a(SIN_RESPONDER, 10), a(NO_ASISTE, 30)],
      60,
    );
    // 40 + 15 = 55 no alcanza; 40 + 15 + 10 = 65 sí.
    assert.equal(q.faltanUnidades, 2);
  });

  it('faltanUnidades es null si ni con todas las sin responder alcanza', () => {
    const q = calcularQuorum([a(ASISTE, 20), a(SIN_RESPONDER, 10), a(NO_ASISTE, 70)], 60);
    assert.equal(q.faltanUnidades, null);
  });
});

describe('porcentajeDeQuorum', () => {
  it('es 0 si el total es 0', () => {
    assert.equal(porcentajeDeQuorum(0, 0), 0);
  });

  it('redondea a dos decimales', () => {
    assert.equal(porcentajeDeQuorum(2, 3), 66.67);
  });
});
```

- [ ] **Step 2: Correrlo y verificar que falla**

Run: `node --require ts-node/register/transpile-only --test src/modules/asambleas/quorum.spec.ts`
Expected: FAIL con `Cannot find module './quorum'`.

- [ ] **Step 3: Implementar**

```ts
import { EstadoAsistencia } from '../../database/entities';

/** Lo mínimo de una asistencia que hace falta para medir el quórum. */
export interface AsistenciaParaQuorum {
  estado: EstadoAsistencia;
  coeficienteAplicado: number;
}

export interface Quorum {
  /** Porcentaje de coeficientes presentes, con dos decimales. */
  porcentaje: number;
  requerido: number;
  alcanzado: boolean;
  /** Puntos porcentuales que faltan para el requerido (0 si se alcanzó). */
  faltanPuntos: number;
  /**
   * Cuántas unidades sin responder harían falta, tomando primero las de mayor
   * coeficiente. `null` si ni confirmando todas se llega.
   */
  faltanUnidades: number | null;
  conteo: Record<EstadoAsistencia, number>;
}

/** Cuentan para el quórum quien asiste y quien está representado por poder. */
const PRESENTES = new Set<EstadoAsistencia>([EstadoAsistencia.ASISTE, EstadoAsistencia.CON_PODER]);

const redondear = (n: number) => Math.round(n * 100) / 100;

export function porcentajeDeQuorum(presente: number, total: number): number {
  return total > 0 ? redondear((presente / total) * 100) : 0;
}

/**
 * Quórum por coeficiente: la suma de los coeficientes presentes sobre la suma
 * de todos los coeficientes convocados. Se usa el coeficiente copiado al
 * convocar, no el actual de la unidad.
 */
export function calcularQuorum(asistencias: AsistenciaParaQuorum[], requerido: number): Quorum {
  const conteo: Record<EstadoAsistencia, number> = {
    [EstadoAsistencia.ASISTE]: 0,
    [EstadoAsistencia.NO_ASISTE]: 0,
    [EstadoAsistencia.SIN_RESPONDER]: 0,
    [EstadoAsistencia.CON_PODER]: 0,
  };
  let total = 0;
  let presente = 0;
  for (const asistencia of asistencias) {
    conteo[asistencia.estado] += 1;
    total += asistencia.coeficienteAplicado;
    if (PRESENTES.has(asistencia.estado)) presente += asistencia.coeficienteAplicado;
  }

  const porcentaje = porcentajeDeQuorum(presente, total);
  const alcanzado = total > 0 && porcentaje >= requerido;

  return {
    porcentaje,
    requerido,
    alcanzado,
    faltanPuntos: alcanzado ? 0 : redondear(requerido - porcentaje),
    faltanUnidades: alcanzado ? 0 : unidadesQueFaltan(asistencias, presente, total, requerido),
    conteo,
  };
}

function unidadesQueFaltan(
  asistencias: AsistenciaParaQuorum[],
  presente: number,
  total: number,
  requerido: number,
): number | null {
  const pendientes = asistencias
    .filter((a) => a.estado === EstadoAsistencia.SIN_RESPONDER)
    .map((a) => a.coeficienteAplicado)
    .sort((x, y) => y - x);

  let acumulado = presente;
  for (let i = 0; i < pendientes.length; i++) {
    acumulado += pendientes[i];
    if (porcentajeDeQuorum(acumulado, total) >= requerido) return i + 1;
  }
  return null;
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `node --require ts-node/register/transpile-only --test src/modules/asambleas/quorum.spec.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/asambleas/quorum.ts apps/backend/src/modules/asambleas/quorum.spec.ts
git commit -m "feat(asambleas): cálculo de quórum por coeficiente

Función pura para que el detalle, el listado y el cierre midan el quórum
con la misma regla y se pueda testear sin base."
```

---

### Task 2: DTOs

**Files (todos en `apps/backend/src/modules/asambleas/dto/`):**
- Create: `punto-orden-dia.dto.ts`, `create-asamblea.dto.ts`, `update-asamblea.dto.ts`, `reemplazar-orden-dia.dto.ts`, `listar-asambleas.query.ts`, `cargar-acta.dto.ts`, `confirmar-asistencia.dto.ts`, `registrar-asistencia.dto.ts`

- [ ] **Step 1: `punto-orden-dia.dto.ts`**

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { TipoPuntoOrden } from '../../../database/entities';

/** Un punto del orden del día. El número de orden lo da su posición en la lista. */
export class PuntoOrdenDiaDto {
  @ApiProperty({ example: 'Cambio de la bomba de agua' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  titulo: string;

  @ApiPropertyOptional({ example: 'Presupuesto de $ 3.480.000' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descripcion?: string;

  @ApiPropertyOptional({ enum: TipoPuntoOrden, default: TipoPuntoOrden.INFORMATIVO })
  @IsOptional()
  @IsEnum(TipoPuntoOrden)
  tipo?: TipoPuntoOrden;
}
```

- [ ] **Step 2: `create-asamblea.dto.ts`**

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ModalidadAsamblea, TipoAsamblea } from '../../../database/entities';
import { PuntoOrdenDiaDto } from './punto-orden-dia.dto';

export class CreateAsambleaDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  consorcioId: string;

  @ApiProperty({ example: 'Asamblea ordinaria · 2º semestre 2026' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  titulo: string;

  @ApiPropertyOptional({ enum: TipoAsamblea, default: TipoAsamblea.ORDINARIA })
  @IsOptional()
  @IsEnum(TipoAsamblea)
  tipo?: TipoAsamblea;

  @ApiPropertyOptional({ enum: ModalidadAsamblea, default: ModalidadAsamblea.PRESENCIAL })
  @IsOptional()
  @IsEnum(ModalidadAsamblea)
  modalidad?: ModalidadAsamblea;

  @ApiProperty({ example: '2026-11-12T19:00:00-03:00', description: 'Fecha y hora, tiene que ser futura' })
  @IsDateString()
  fechaHora: string;

  @ApiPropertyOptional({ example: 'SUM del edificio', description: 'Obligatorio si es presencial o híbrida' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  lugar?: string | null;

  @ApiPropertyOptional({ example: 'https://meet.example.com/abc', description: 'Obligatorio si es digital o híbrida' })
  @IsOptional()
  @IsUrl()
  linkVideollamada?: string | null;

  @ApiPropertyOptional({ example: 60, default: 60, description: 'Porcentaje de coeficientes para sesionar' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  quorumRequerido?: number;

  @ApiPropertyOptional({ type: [PuntoOrdenDiaDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PuntoOrdenDiaDto)
  puntos?: PuntoOrdenDiaDto[];
}
```

- [ ] **Step 3: `update-asamblea.dto.ts`**

```ts
import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateAsambleaDto } from './create-asamblea.dto';

/**
 * El consorcio no se cambia: si se cargó mal, se borra el borrador y se crea
 * otra. El orden del día se reemplaza aparte, con `PUT /asambleas/:id/orden-dia`.
 */
export class UpdateAsambleaDto extends PartialType(
  OmitType(CreateAsambleaDto, ['consorcioId', 'puntos'] as const),
) {}
```

- [ ] **Step 4: `reemplazar-orden-dia.dto.ts`**

```ts
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import { PuntoOrdenDiaDto } from './punto-orden-dia.dto';

export class ReemplazarOrdenDiaDto {
  @ApiProperty({ type: [PuntoOrdenDiaDto], description: 'La lista completa, en orden' })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PuntoOrdenDiaDto)
  puntos: PuntoOrdenDiaDto[];
}
```

- [ ] **Step 5: `listar-asambleas.query.ts`**

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { EstadoAsamblea } from '../../../database/entities';

export class ListarAsambleasQuery {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  consorcioId?: string;

  @ApiPropertyOptional({ enum: EstadoAsamblea })
  @IsOptional()
  @IsEnum(EstadoAsamblea)
  estado?: EstadoAsamblea;

  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  anio?: number;
}
```

- [ ] **Step 6: `cargar-acta.dto.ts`**

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsUrl } from 'class-validator';

export class CargarActaDto {
  @ApiProperty({ example: 'https://storage.example.com/actas/2026-09-12.pdf' })
  @IsUrl()
  actaUrl: string;
}
```

- [ ] **Step 7: `confirmar-asistencia.dto.ts`**

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { EstadoAsistencia } from '../../../database/entities';

/** Lo que responde el vecino: "Asisto" o "No puedo". El poder lo registra el admin. */
export const RESPUESTAS_VECINO = [EstadoAsistencia.ASISTE, EstadoAsistencia.NO_ASISTE] as const;

export class ConfirmarAsistenciaDto {
  @ApiProperty({ enum: RESPUESTAS_VECINO })
  @IsIn(RESPUESTAS_VECINO)
  estado: (typeof RESPUESTAS_VECINO)[number];

  @ApiPropertyOptional({ format: 'uuid', description: 'Sólo si tiene más de una unidad en el consorcio' })
  @IsOptional()
  @IsUUID()
  unidadId?: string;
}
```

- [ ] **Step 8: `registrar-asistencia.dto.ts`**

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { EstadoAsistencia } from '../../../database/entities';

export class RegistrarAsistenciaDto {
  @ApiProperty({ enum: EstadoAsistencia })
  @IsEnum(EstadoAsistencia)
  estado: EstadoAsistencia;

  @ApiPropertyOptional({ format: 'uuid', description: 'Obligatorio con CON_PODER: la unidad que la representa' })
  @IsOptional()
  @IsUUID()
  apoderadoUnidadId?: string;
}
```

- [ ] **Step 9: Verificar tipos**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: sin errores.

- [ ] **Step 10: Commit**

```bash
git add apps/backend/src/modules/asambleas/dto
git commit -m "feat(asambleas): DTOs de asambleas, orden del día y asistencia

El vecino sólo puede responder ASISTE o NO_ASISTE desde la validación,
así el poder queda reservado al administrador sin chequeos extra."
```

---

### Task 3: Repository

**Files:**
- Create: `apps/backend/src/modules/asambleas/asambleas.repository.ts`

Sin test unitario propio (es acceso a datos, igual que el resto de los repositories del repo); se ejercita a mano en la Task 7.

- [ ] **Step 1: Implementar**

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, DeepPartial, EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import {
  Asamblea,
  Asistencia,
  EstadoAsamblea,
  EstadoAsistencia,
  PuntoOrdenDia,
  TipoPuntoOrden,
  Unidad,
  UnidadUsuario,
} from '../../database/entities';
import { ListarAsambleasQuery } from './dto/listar-asambleas.query';

export interface PuntoNuevo {
  titulo: string;
  descripcion?: string | null;
  tipo?: TipoPuntoOrden;
}

export interface AsistenciaNueva {
  unidadId: string;
  coeficienteAplicado: number;
}

/** Coeficientes presentes y totales de una asamblea, para el listado. */
export interface AgregadoQuorum {
  presente: number;
  total: number;
}

@Injectable()
export class AsambleasRepository {
  constructor(
    @InjectRepository(Asamblea)
    private readonly asambleas: Repository<Asamblea>,
    @InjectRepository(Asistencia)
    private readonly asistenciasRepo: Repository<Asistencia>,
    @InjectRepository(Unidad)
    private readonly unidades: Repository<Unidad>,
    @InjectRepository(UnidadUsuario)
    private readonly vinculos: Repository<UnidadUsuario>,
    private readonly dataSource: DataSource,
  ) {}

  // ── Asambleas ──────────────────────────────────────────────────────────────

  listar(
    query: ListarAsambleasQuery,
    filtro: { consorcioIds?: string[]; ocultarBorradores: boolean },
  ): Promise<Asamblea[]> {
    if (filtro.consorcioIds && filtro.consorcioIds.length === 0) return Promise.resolve([]);

    const qb = this.asambleas.createQueryBuilder('a').orderBy('a.fechaHora', 'DESC');

    if (query.consorcioId) qb.andWhere('a.consorcio_id = :consorcioId', { consorcioId: query.consorcioId });
    if (filtro.consorcioIds) qb.andWhere('a.consorcio_id IN (:...consorcioIds)', { consorcioIds: filtro.consorcioIds });
    if (filtro.ocultarBorradores) qb.andWhere('a.estado <> :borrador', { borrador: EstadoAsamblea.BORRADOR });
    if (query.estado) qb.andWhere('a.estado = :estado', { estado: query.estado });
    if (query.anio) qb.andWhere('EXTRACT(YEAR FROM a.fecha_hora) = :anio', { anio: query.anio });

    return qb.getMany();
  }

  /** Un solo `SUM` agrupado para todo el listado, en vez de una consulta por fila. */
  async agregadosQuorum(asambleaIds: string[]): Promise<Map<string, AgregadoQuorum>> {
    if (asambleaIds.length === 0) return new Map();

    const filas = await this.asistenciasRepo
      .createQueryBuilder('s')
      .select('s.asamblea_id', 'asambleaId')
      .addSelect(
        'SUM(CASE WHEN s.estado IN (:...presentes) THEN s.coeficiente_aplicado ELSE 0 END)',
        'presente',
      )
      .addSelect('SUM(s.coeficiente_aplicado)', 'total')
      .where('s.asamblea_id IN (:...asambleaIds)', { asambleaIds })
      .setParameter('presentes', [EstadoAsistencia.ASISTE, EstadoAsistencia.CON_PODER])
      .groupBy('s.asamblea_id')
      .getRawMany<{ asambleaId: string; presente: string; total: string }>();

    return new Map(
      filas.map((f) => [f.asambleaId, { presente: Number(f.presente), total: Number(f.total) }]),
    );
  }

  findById(id: string): Promise<Asamblea | null> {
    return this.asambleas.findOne({
      where: { id },
      relations: { puntoOrdenDias: true },
      order: { puntoOrdenDias: { orden: 'ASC' } },
    });
  }

  crear(datos: DeepPartial<Asamblea>, puntos: PuntoNuevo[]): Promise<string> {
    return this.dataSource.transaction(async (m) => {
      const asamblea = await m.save(m.create(Asamblea, datos));
      await this.insertarPuntos(m, asamblea.id, puntos);
      return asamblea.id;
    });
  }

  async actualizar(id: string, cambios: DeepPartial<Asamblea>): Promise<void> {
    await this.asambleas.update({ id }, { ...cambios, updatedAt: new Date() } as never);
  }

  /** Borra y reinserta: el orden lo da la posición y el UNIQUE (asamblea, orden) no deja renumerar en el lugar. */
  async reemplazarOrdenDia(asambleaId: string, puntos: PuntoNuevo[]): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      await m.delete(PuntoOrdenDia, { asambleaId });
      await this.insertarPuntos(m, asambleaId, puntos);
    });
  }

  async eliminar(id: string): Promise<void> {
    await this.asambleas.delete({ id });
  }

  // ── Convocatoria y asistencia ──────────────────────────────────────────────

  unidadesActivas(consorcioId: string): Promise<Pick<Unidad, 'id' | 'coeficiente'>[]> {
    return this.unidades.find({
      where: { consorcioId, activa: true },
      select: { id: true, coeficiente: true },
    });
  }

  /** El padrón de asistencia y el cambio de estado van juntos o no van. */
  async convocar(asambleaId: string, asistencias: AsistenciaNueva[]): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      await m.save(
        asistencias.map((a) => m.create(Asistencia, { ...a, asambleaId })),
        { chunk: 500 },
      );
      await m.update(Asamblea, { id: asambleaId }, { estado: EstadoAsamblea.CONVOCADA, updatedAt: new Date() });
    });
  }

  asistencias(asambleaId: string): Promise<Asistencia[]> {
    return this.asistenciasRepo.find({
      where: { asambleaId },
      relations: { unidad: true, apoderadoUnidad: true, confirmadaPor: true },
      order: { unidad: { etiqueta: 'ASC' } },
    });
  }

  findAsistencia(asambleaId: string, unidadId: string): Promise<Asistencia | null> {
    return this.asistenciasRepo.findOne({
      where: { asambleaId, unidadId },
      relations: { unidad: true, apoderadoUnidad: true, confirmadaPor: true },
    });
  }

  async guardarAsistencia(id: string, cambios: DeepPartial<Asistencia>): Promise<void> {
    await this.asistenciasRepo.update({ id }, { ...cambios, updatedAt: new Date() } as never);
  }

  // ── Vínculos ───────────────────────────────────────────────────────────────

  /** Consorcios donde el usuario tiene hoy alguna unidad. */
  async consorciosDelUsuario(usuarioId: string): Promise<string[]> {
    const filas = await this.vinculosVigentes()
      .select('DISTINCT u.consorcio_id', 'consorcioId')
      .andWhere('v.usuario_id = :usuarioId', { usuarioId })
      .getRawMany<{ consorcioId: string }>();
    return filas.map((f) => f.consorcioId);
  }

  async unidadesDelUsuarioEnConsorcio(usuarioId: string, consorcioId: string): Promise<string[]> {
    const filas = await this.vinculosVigentes()
      .select('v.unidad_id', 'unidadId')
      .andWhere('v.usuario_id = :usuarioId', { usuarioId })
      .andWhere('u.consorcio_id = :consorcioId', { consorcioId })
      .getRawMany<{ unidadId: string }>();
    return filas.map((f) => f.unidadId);
  }

  /** A quién avisar de una convocatoria: vecinos con vínculo vigente a una unidad activa. */
  async vecinosDelConsorcio(consorcioId: string): Promise<string[]> {
    const filas = await this.vinculosVigentes()
      .select('DISTINCT v.usuario_id', 'usuarioId')
      .andWhere('u.consorcio_id = :consorcioId', { consorcioId })
      .andWhere('u.activa = true')
      .getRawMany<{ usuarioId: string }>();
    return filas.map((f) => f.usuarioId);
  }

  // ── Privados ───────────────────────────────────────────────────────────────

  /** Un vínculo con `hasta` en el pasado es alguien que ya no vive ahí. */
  private vinculosVigentes(): SelectQueryBuilder<UnidadUsuario> {
    return this.vinculos
      .createQueryBuilder('v')
      .innerJoin('v.unidad', 'u')
      .where(new Brackets((qb) => qb.where('v.hasta IS NULL').orWhere('v.hasta >= CURRENT_DATE')));
  }

  private async insertarPuntos(m: EntityManager, asambleaId: string, puntos: PuntoNuevo[]) {
    if (puntos.length === 0) return;
    await m.save(
      puntos.map((p, i) =>
        m.create(PuntoOrdenDia, {
          asambleaId,
          orden: i + 1,
          titulo: p.titulo,
          descripcion: p.descripcion ?? null,
          tipo: p.tipo ?? TipoPuntoOrden.INFORMATIVO,
        }),
      ),
    );
  }
}
```

- [ ] **Step 2: Verificar tipos**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: sin errores. Si `update(..., { ... } as never)` molesta al lint, reemplazar por `QueryDeepPartialEntity<Asamblea>` importado de `typeorm/query-builder/QueryPartialEntity`.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/asambleas/asambleas.repository.ts
git commit -m "feat(asambleas): repository con convocatoria transaccional

Convocar crea el padrón de asistencia y cambia el estado en la misma
transacción: una asamblea convocada sin padrón no podría medir quórum."
```

---

### Task 4: Service (TDD)

**Files:**
- Create: `apps/backend/src/modules/asambleas/asambleas.service.ts`
- Test: `apps/backend/src/modules/asambleas/asambleas.service.spec.ts`

- [ ] **Step 1: Escribir los tests que fallan**

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
  Asistencia,
  EstadoAsamblea,
  EstadoAsistencia,
  ModalidadAsamblea,
  RolUsuario,
} from '../../database/entities';
import type { UsuarioActual } from '../auth/auth.types';
import type { ConsorciosService } from '../consorcios/consorcios.service';
import type { AsambleasRepository } from './asambleas.repository';
import { AsambleasService } from './asambleas.service';

const admin: UsuarioActual = { id: 'a1', email: 'a@x', rol: RolUsuario.ADMINISTRADOR };
const vecino: UsuarioActual = { id: 'v1', email: 'v@x', rol: RolUsuario.VECINO };

const FUTURO = new Date(Date.now() + 7 * 24 * 3600 * 1000);

const asamblea = (over: Partial<Asamblea> = {}) =>
  ({
    id: 'as1',
    consorcioId: 'c1',
    titulo: 'Ordinaria',
    modalidad: ModalidadAsamblea.PRESENCIAL,
    lugar: 'SUM',
    linkVideollamada: null,
    fechaHora: FUTURO,
    quorumRequerido: 60,
    estado: EstadoAsamblea.BORRADOR,
    puntoOrdenDias: [{ id: 'p1', orden: 1, titulo: 'Acta' }],
    ...over,
  }) as Asamblea;

const asistencia = (unidadId: string, estado: EstadoAsistencia, coef: number) =>
  ({
    id: `s-${unidadId}`,
    unidadId,
    estado,
    coeficienteAplicado: coef,
    unidad: { id: unidadId, etiqueta: unidadId },
    apoderadoUnidad: null,
    confirmadaPor: null,
    confirmadaAt: null,
  }) as unknown as Asistencia;

/** Repository en memoria que anota las escrituras. */
function crearService(opts: {
  asamblea?: Asamblea | null;
  asistencias?: Asistencia[];
  unidadesActivas?: { id: string; coeficiente: number }[];
  unidadesDelVecino?: string[];
  consorciosDelVecino?: string[];
} = {}) {
  const escrito = {
    creada: null as unknown,
    actualizada: [] as unknown[],
    convocada: null as unknown,
    asistencia: [] as unknown[],
    listarFiltro: null as unknown,
  };
  const asistencias = opts.asistencias ?? [];
  const repo = {
    listar: async (_q: unknown, filtro: unknown) => {
      escrito.listarFiltro = filtro;
      return [];
    },
    agregadosQuorum: async () => new Map(),
    findById: async () => (opts.asamblea === undefined ? asamblea() : opts.asamblea),
    crear: async (datos: unknown) => {
      escrito.creada = datos;
      return 'as1';
    },
    actualizar: async (_id: string, cambios: unknown) => {
      escrito.actualizada.push(cambios);
    },
    reemplazarOrdenDia: async () => undefined,
    eliminar: async () => undefined,
    unidadesActivas: async () => opts.unidadesActivas ?? [{ id: 'u1', coeficiente: 50 }, { id: 'u2', coeficiente: 50 }],
    convocar: async (_id: string, filas: unknown) => {
      escrito.convocada = filas;
    },
    asistencias: async () => asistencias,
    findAsistencia: async (_a: string, unidadId: string) =>
      asistencias.find((s) => s.unidadId === unidadId) ?? null,
    guardarAsistencia: async (_id: string, cambios: unknown) => {
      escrito.asistencia.push(cambios);
    },
    consorciosDelUsuario: async () => opts.consorciosDelVecino ?? ['c1'],
    unidadesDelUsuarioEnConsorcio: async () => opts.unidadesDelVecino ?? [],
    vecinosDelConsorcio: async () => ['v1'],
  } as unknown as AsambleasRepository;
  const consorcios = { findOne: async () => ({ id: 'c1' }) } as unknown as ConsorciosService;
  const notificador = { enviar: async () => undefined } as unknown as Notificador;
  return { service: new AsambleasService(repo, consorcios, notificador), escrito };
}

const crearDto = (over = {}) => ({
  consorcioId: 'c1',
  titulo: 'Ordinaria',
  fechaHora: FUTURO.toISOString(),
  lugar: 'SUM',
  ...over,
});

describe('AsambleasService — crear y editar', () => {
  it('crea en borrador con quórum 60 por defecto', async () => {
    const { service, escrito } = crearService();
    await service.crear(admin, crearDto());
    assert.equal((escrito.creada as Asamblea).quorumRequerido, 60);
    assert.equal((escrito.creada as Asamblea).creadaPorId, 'a1');
  });

  it('presencial sin lugar es 400', async () => {
    const { service } = crearService();
    await assert.rejects(service.crear(admin, crearDto({ lugar: undefined })), BadRequestException);
  });

  it('digital sin link es 400', async () => {
    const { service } = crearService();
    await assert.rejects(
      service.crear(admin, crearDto({ modalidad: ModalidadAsamblea.DIGITAL })),
      BadRequestException,
    );
  });

  it('híbrida exige lugar y link', async () => {
    const { service } = crearService();
    await assert.rejects(
      service.crear(admin, crearDto({ modalidad: ModalidadAsamblea.HIBRIDA })),
      BadRequestException,
    );
  });

  it('fecha pasada es 400', async () => {
    const { service } = crearService();
    await assert.rejects(
      service.crear(admin, crearDto({ fechaHora: '2020-01-01T19:00:00Z' })),
      BadRequestException,
    );
  });

  it('no se edita una asamblea convocada', async () => {
    const { service } = crearService({ asamblea: asamblea({ estado: EstadoAsamblea.CONVOCADA }) });
    await assert.rejects(service.editar(admin, 'as1', { titulo: 'Otro' }), ConflictException);
  });

  it('no se elimina una asamblea convocada', async () => {
    const { service } = crearService({ asamblea: asamblea({ estado: EstadoAsamblea.CONVOCADA }) });
    await assert.rejects(service.eliminar(admin, 'as1'), ConflictException);
  });
});

describe('AsambleasService — ciclo de vida', () => {
  it('convocar copia el coeficiente de cada unidad activa', async () => {
    const { service, escrito } = crearService({
      unidadesActivas: [{ id: 'u1', coeficiente: 12.5 }, { id: 'u2', coeficiente: 87.5 }],
    });
    await service.convocar(admin, 'as1');
    assert.deepEqual(escrito.convocada, [
      { unidadId: 'u1', coeficienteAplicado: 12.5 },
      { unidadId: 'u2', coeficienteAplicado: 87.5 },
    ]);
  });

  it('convocar sin orden del día es 400', async () => {
    const { service } = crearService({ asamblea: asamblea({ puntoOrdenDias: [] }) });
    await assert.rejects(service.convocar(admin, 'as1'), BadRequestException);
  });

  it('convocar sin unidades activas es 400', async () => {
    const { service } = crearService({ unidadesActivas: [] });
    await assert.rejects(service.convocar(admin, 'as1'), BadRequestException);
  });

  it('iniciar sólo desde convocada', async () => {
    const { service } = crearService();
    await assert.rejects(service.iniciar(admin, 'as1'), ConflictException);
  });

  it('cerrar con quórum alcanzado queda CERRADA', async () => {
    const { service, escrito } = crearService({
      asamblea: asamblea({ estado: EstadoAsamblea.EN_CURSO }),
      asistencias: [asistencia('u1', EstadoAsistencia.ASISTE, 70), asistencia('u2', EstadoAsistencia.NO_ASISTE, 30)],
    });
    await service.cerrar(admin, 'as1');
    assert.deepEqual(escrito.actualizada, [{ estado: EstadoAsamblea.CERRADA }]);
  });

  it('cerrar sin quórum queda CERRADA_SIN_QUORUM', async () => {
    const { service, escrito } = crearService({
      asamblea: asamblea({ estado: EstadoAsamblea.EN_CURSO }),
      asistencias: [asistencia('u1', EstadoAsistencia.ASISTE, 30), asistencia('u2', EstadoAsistencia.SIN_RESPONDER, 70)],
    });
    await service.cerrar(admin, 'as1');
    assert.deepEqual(escrito.actualizada, [{ estado: EstadoAsamblea.CERRADA_SIN_QUORUM }]);
  });

  it('el acta sólo se carga en una asamblea cerrada', async () => {
    const { service } = crearService({ asamblea: asamblea({ estado: EstadoAsamblea.EN_CURSO }) });
    await assert.rejects(
      service.cargarActa(admin, 'as1', { actaUrl: 'https://x.com/acta.pdf' }),
      ConflictException,
    );
  });
});

describe('AsambleasService — asistencia del vecino', () => {
  const convocada = asamblea({ estado: EstadoAsamblea.CONVOCADA });
  const padron = () => [
    asistencia('u1', EstadoAsistencia.SIN_RESPONDER, 50),
    asistencia('u2', EstadoAsistencia.SIN_RESPONDER, 50),
  ];

  it('infiere la unidad si tiene una sola', async () => {
    const { service, escrito } = crearService({ asamblea: convocada, asistencias: padron(), unidadesDelVecino: ['u1'] });
    await service.confirmarAsistencia(vecino, 'as1', { estado: EstadoAsistencia.ASISTE });
    assert.equal((escrito.asistencia[0] as Asistencia).estado, EstadoAsistencia.ASISTE);
    assert.equal((escrito.asistencia[0] as Asistencia).confirmadaPorId, 'v1');
  });

  it('con varias unidades y sin indicar es 400', async () => {
    const { service } = crearService({ asamblea: convocada, asistencias: padron(), unidadesDelVecino: ['u1', 'u2'] });
    await assert.rejects(
      service.confirmarAsistencia(vecino, 'as1', { estado: EstadoAsistencia.ASISTE }),
      BadRequestException,
    );
  });

  it('una unidad ajena es 403', async () => {
    const { service } = crearService({ asamblea: convocada, asistencias: padron(), unidadesDelVecino: ['u1'] });
    await assert.rejects(
      service.confirmarAsistencia(vecino, 'as1', { estado: EstadoAsistencia.ASISTE, unidadId: 'u2' }),
      ForbiddenException,
    );
  });

  it('no puede responder en una asamblea cerrada', async () => {
    const { service } = crearService({
      asamblea: asamblea({ estado: EstadoAsamblea.CERRADA }),
      asistencias: padron(),
      unidadesDelVecino: ['u1'],
    });
    await assert.rejects(
      service.confirmarAsistencia(vecino, 'as1', { estado: EstadoAsistencia.ASISTE }),
      ConflictException,
    );
  });

  it('no ve borradores: 404', async () => {
    const { service } = crearService({ unidadesDelVecino: ['u1'] });
    await assert.rejects(service.findOne(vecino, 'as1'), NotFoundException);
  });

  it('no ve asambleas de otros consorcios: 404', async () => {
    const { service } = crearService({ asamblea: convocada, consorciosDelVecino: ['otro'] });
    await assert.rejects(service.findOne(vecino, 'as1'), NotFoundException);
  });

  it('el listado del vecino filtra por sus consorcios y oculta borradores', async () => {
    const { service, escrito } = crearService({ consorciosDelVecino: ['c1'] });
    await service.listar(vecino, {});
    assert.deepEqual(escrito.listarFiltro, { consorcioIds: ['c1'], ocultarBorradores: true });
  });
});

describe('AsambleasService — asistencia registrada por el admin', () => {
  const enCurso = asamblea({ estado: EstadoAsamblea.EN_CURSO });
  const padron = () => [
    asistencia('u1', EstadoAsistencia.SIN_RESPONDER, 50),
    asistencia('u2', EstadoAsistencia.ASISTE, 50),
  ];

  it('poder sin apoderado es 400', async () => {
    const { service } = crearService({ asamblea: enCurso, asistencias: padron() });
    await assert.rejects(
      service.registrarAsistencia(admin, 'as1', 'u1', { estado: EstadoAsistencia.CON_PODER }),
      BadRequestException,
    );
  });

  it('una unidad no puede ser su propia apoderada', async () => {
    const { service } = crearService({ asamblea: enCurso, asistencias: padron() });
    await assert.rejects(
      service.registrarAsistencia(admin, 'as1', 'u1', { estado: EstadoAsistencia.CON_PODER, apoderadoUnidadId: 'u1' }),
      BadRequestException,
    );
  });

  it('el apoderado tiene que estar en el padrón de la asamblea', async () => {
    const { service } = crearService({ asamblea: enCurso, asistencias: padron() });
    await assert.rejects(
      service.registrarAsistencia(admin, 'as1', 'u1', { estado: EstadoAsistencia.CON_PODER, apoderadoUnidadId: 'u9' }),
      BadRequestException,
    );
  });

  it('registra un poder válido', async () => {
    const { service, escrito } = crearService({ asamblea: enCurso, asistencias: padron() });
    await service.registrarAsistencia(admin, 'as1', 'u1', { estado: EstadoAsistencia.CON_PODER, apoderadoUnidadId: 'u2' });
    assert.equal((escrito.asistencia[0] as Asistencia).apoderadoUnidadId, 'u2');
  });

  it('fuera del padrón es 404', async () => {
    const { service } = crearService({ asamblea: enCurso, asistencias: padron() });
    await assert.rejects(
      service.registrarAsistencia(admin, 'as1', 'u9', { estado: EstadoAsistencia.ASISTE }),
      NotFoundException,
    );
  });

  it('al pasar a otro estado limpia el apoderado', async () => {
    const { service, escrito } = crearService({ asamblea: enCurso, asistencias: padron() });
    await service.registrarAsistencia(admin, 'as1', 'u1', { estado: EstadoAsistencia.ASISTE, apoderadoUnidadId: 'u2' });
    assert.equal((escrito.asistencia[0] as Asistencia).apoderadoUnidadId, null);
  });
});
```

- [ ] **Step 2: Correrlos y verificar que fallan**

Run: `node --require ts-node/register/transpile-only --test src/modules/asambleas/asambleas.service.spec.ts`
Expected: FAIL con `Cannot find module './asambleas.service'`.

- [ ] **Step 3: Implementar el service**

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
  Asamblea,
  Asistencia,
  EstadoAsamblea,
  EstadoAsistencia,
  ModalidadAsamblea,
  RolUsuario,
} from '../../database/entities';
import type { UsuarioActual } from '../auth/auth.types';
import { ConsorciosService } from '../consorcios/consorcios.service';
import { AsambleasRepository } from './asambleas.repository';
import { CargarActaDto } from './dto/cargar-acta.dto';
import { ConfirmarAsistenciaDto } from './dto/confirmar-asistencia.dto';
import { CreateAsambleaDto } from './dto/create-asamblea.dto';
import { ListarAsambleasQuery } from './dto/listar-asambleas.query';
import { RegistrarAsistenciaDto } from './dto/registrar-asistencia.dto';
import { ReemplazarOrdenDiaDto } from './dto/reemplazar-orden-dia.dto';
import { UpdateAsambleaDto } from './dto/update-asamblea.dto';
import { calcularQuorum, porcentajeDeQuorum } from './quorum';

/** Mismo criterio que reclamos: el superadmin gestiona como un administrador. */
const esAdmin = (usuario: UsuarioActual) =>
  usuario.rol === RolUsuario.ADMINISTRADOR || usuario.rol === RolUsuario.SUPER_ADMIN;

const QUORUM_POR_DEFECTO = 60;
const ULTIMAS_CONFIRMACIONES = 10;

/** Mientras se puede responder la asistencia. */
const ASISTENCIA_ABIERTA = [EstadoAsamblea.CONVOCADA, EstadoAsamblea.EN_CURSO];
const CERRADAS = [EstadoAsamblea.CERRADA, EstadoAsamblea.CERRADA_SIN_QUORUM];

/** Lo que se muestra de una asistencia: nunca la entidad `Usuario` entera (trae el hash). */
function vistaAsistencia(a: Asistencia) {
  return {
    id: a.id,
    unidadId: a.unidadId,
    unidad: a.unidad ? { id: a.unidad.id, etiqueta: a.unidad.etiqueta } : null,
    estado: a.estado,
    coeficienteAplicado: a.coeficienteAplicado,
    apoderadoUnidad: a.apoderadoUnidad ? { id: a.apoderadoUnidad.id, etiqueta: a.apoderadoUnidad.etiqueta } : null,
    confirmadaPor: a.confirmadaPor
      ? { id: a.confirmadaPor.id, nombre: a.confirmadaPor.nombre, apellido: a.confirmadaPor.apellido }
      : null,
    confirmadaAt: a.confirmadaAt,
  };
}

@Injectable()
export class AsambleasService {
  private readonly logger = new Logger(AsambleasService.name);

  constructor(
    private readonly asambleas: AsambleasRepository,
    private readonly consorcios: ConsorciosService,
    private readonly notificador: Notificador,
  ) {}

  // ── Consultas ──────────────────────────────────────────────────────────────

  async listar(usuario: UsuarioActual, query: ListarAsambleasQuery) {
    const filtro = esAdmin(usuario)
      ? { ocultarBorradores: false }
      : { consorcioIds: await this.asambleas.consorciosDelUsuario(usuario.id), ocultarBorradores: true };

    const asambleas = await this.asambleas.listar(query, filtro);
    const agregados = await this.asambleas.agregadosQuorum(asambleas.map((a) => a.id));

    return asambleas.map((a) => {
      const agregado = agregados.get(a.id);
      return {
        ...a,
        quorumPorcentaje: agregado ? porcentajeDeQuorum(agregado.presente, agregado.total) : null,
      };
    });
  }

  async findOne(usuario: UsuarioActual, id: string) {
    const asamblea = await this.buscarConPermiso(usuario, id);
    const asistencias = await this.asambleas.asistencias(id);
    const quorum = asistencias.length > 0 ? calcularQuorum(asistencias, asamblea.quorumRequerido) : null;

    if (esAdmin(usuario)) {
      const ultimasConfirmaciones = asistencias
        .filter((a) => a.confirmadaAt)
        .sort((x, y) => (y.confirmadaAt as Date).getTime() - (x.confirmadaAt as Date).getTime())
        .slice(0, ULTIMAS_CONFIRMACIONES)
        .map(vistaAsistencia);
      return { ...asamblea, quorum, ultimasConfirmaciones };
    }

    const mias = await this.asambleas.unidadesDelUsuarioEnConsorcio(usuario.id, asamblea.consorcioId);
    const miAsistencia = asistencias.filter((a) => mias.includes(a.unidadId)).map(vistaAsistencia);
    return { ...asamblea, quorum, miAsistencia };
  }

  async listarAsistencias(id: string) {
    await this.exigirAsamblea(id);
    const asistencias = await this.asambleas.asistencias(id);
    return asistencias.map(vistaAsistencia);
  }

  // ── ABM ────────────────────────────────────────────────────────────────────

  async crear(usuario: UsuarioActual, dto: CreateAsambleaDto) {
    // 404 si el consorcio no existe.
    await this.consorcios.findOne(dto.consorcioId);

    const modalidad = dto.modalidad ?? ModalidadAsamblea.PRESENCIAL;
    const fechaHora = new Date(dto.fechaHora);
    exigirFechaFutura(fechaHora);
    validarModalidad(modalidad, dto.lugar, dto.linkVideollamada);

    const id = await this.asambleas.crear(
      {
        consorcioId: dto.consorcioId,
        creadaPorId: usuario.id,
        titulo: dto.titulo,
        tipo: dto.tipo,
        modalidad,
        fechaHora,
        lugar: dto.lugar ?? null,
        linkVideollamada: dto.linkVideollamada ?? null,
        quorumRequerido: dto.quorumRequerido ?? QUORUM_POR_DEFECTO,
      },
      dto.puntos ?? [],
    );
    return this.findOne(usuario, id);
  }

  async editar(usuario: UsuarioActual, id: string, dto: UpdateAsambleaDto) {
    const asamblea = await this.exigirAsamblea(id);
    exigirEstado(asamblea, [EstadoAsamblea.BORRADOR], 'editar');

    // Se valida el resultado final, no sólo lo que vino en el PATCH.
    const modalidad = dto.modalidad ?? asamblea.modalidad;
    const lugar = dto.lugar !== undefined ? dto.lugar : asamblea.lugar;
    const link = dto.linkVideollamada !== undefined ? dto.linkVideollamada : asamblea.linkVideollamada;
    validarModalidad(modalidad, lugar, link);

    const fechaHora = dto.fechaHora ? new Date(dto.fechaHora) : undefined;
    if (fechaHora) exigirFechaFutura(fechaHora);

    await this.asambleas.actualizar(id, {
      ...(dto.titulo !== undefined && { titulo: dto.titulo }),
      ...(dto.tipo !== undefined && { tipo: dto.tipo }),
      ...(dto.quorumRequerido !== undefined && { quorumRequerido: dto.quorumRequerido }),
      ...(fechaHora && { fechaHora }),
      modalidad,
      lugar: lugar ?? null,
      linkVideollamada: link ?? null,
    });
    return this.findOne(usuario, id);
  }

  async reemplazarOrdenDia(usuario: UsuarioActual, id: string, dto: ReemplazarOrdenDiaDto) {
    const asamblea = await this.exigirAsamblea(id);
    exigirEstado(asamblea, [EstadoAsamblea.BORRADOR], 'cambiar el orden del día de');
    await this.asambleas.reemplazarOrdenDia(id, dto.puntos);
    return this.findOne(usuario, id);
  }

  async eliminar(_usuario: UsuarioActual, id: string): Promise<void> {
    const asamblea = await this.exigirAsamblea(id);
    exigirEstado(asamblea, [EstadoAsamblea.BORRADOR], 'eliminar');
    await this.asambleas.eliminar(id);
  }

  // ── Ciclo de vida ──────────────────────────────────────────────────────────

  /**
   * Arma el padrón: una asistencia por unidad activa con su coeficiente de hoy.
   * Si después se edita una unidad, el quórum de esta asamblea no cambia.
   */
  async convocar(usuario: UsuarioActual, id: string) {
    const asamblea = await this.exigirAsamblea(id);
    exigirEstado(asamblea, [EstadoAsamblea.BORRADOR], 'convocar');
    if (!asamblea.puntoOrdenDias?.length) {
      throw new BadRequestException('Cargá al menos un punto del orden del día antes de convocar');
    }
    exigirFechaFutura(asamblea.fechaHora);

    const unidades = await this.asambleas.unidadesActivas(asamblea.consorcioId);
    if (unidades.length === 0) {
      throw new BadRequestException('El consorcio no tiene unidades activas para convocar');
    }

    await this.asambleas.convocar(
      id,
      unidades.map((u) => ({ unidadId: u.id, coeficienteAplicado: u.coeficiente })),
    );
    await this.avisarConvocatoria(asamblea);
    return this.findOne(usuario, id);
  }

  /** No exige quórum: se puede esperar o pasar a segunda convocatoria. */
  async iniciar(usuario: UsuarioActual, id: string) {
    const asamblea = await this.exigirAsamblea(id);
    exigirEstado(asamblea, [EstadoAsamblea.CONVOCADA], 'iniciar');
    await this.asambleas.actualizar(id, { estado: EstadoAsamblea.EN_CURSO });
    return this.findOne(usuario, id);
  }

  /** El estado final lo decide el quórum alcanzado, no el administrador. */
  async cerrar(usuario: UsuarioActual, id: string) {
    const asamblea = await this.exigirAsamblea(id);
    exigirEstado(asamblea, [EstadoAsamblea.EN_CURSO], 'cerrar');

    const quorum = calcularQuorum(await this.asambleas.asistencias(id), asamblea.quorumRequerido);
    const estado = quorum.alcanzado ? EstadoAsamblea.CERRADA : EstadoAsamblea.CERRADA_SIN_QUORUM;
    await this.asambleas.actualizar(id, { estado });
    return this.findOne(usuario, id);
  }

  async cargarActa(usuario: UsuarioActual, id: string, dto: CargarActaDto) {
    const asamblea = await this.exigirAsamblea(id);
    exigirEstado(asamblea, CERRADAS, 'cargar el acta de');
    await this.asambleas.actualizar(id, { actaUrl: dto.actaUrl });
    return this.findOne(usuario, id);
  }

  // ── Asistencia ─────────────────────────────────────────────────────────────

  async confirmarAsistencia(usuario: UsuarioActual, id: string, dto: ConfirmarAsistenciaDto) {
    if (esAdmin(usuario)) {
      throw new ForbiddenException('El administrador registra la asistencia desde el padrón');
    }
    const asamblea = await this.buscarConPermiso(usuario, id);
    exigirEstado(asamblea, ASISTENCIA_ABIERTA, 'responder la asistencia de');

    const unidadId = await this.resolverUnidad(usuario, asamblea.consorcioId, dto.unidadId);
    const asistencia = await this.exigirAsistencia(id, unidadId);

    await this.asambleas.guardarAsistencia(asistencia.id, {
      estado: dto.estado,
      apoderadoUnidadId: null,
      confirmadaPorId: usuario.id,
      confirmadaAt: new Date(),
    });
    return vistaAsistencia(await this.exigirAsistencia(id, unidadId));
  }

  async registrarAsistencia(usuario: UsuarioActual, id: string, unidadId: string, dto: RegistrarAsistenciaDto) {
    const asamblea = await this.exigirAsamblea(id);
    exigirEstado(asamblea, ASISTENCIA_ABIERTA, 'registrar asistencia en');
    const asistencia = await this.exigirAsistencia(id, unidadId);

    let apoderadoUnidadId: string | null = null;
    if (dto.estado === EstadoAsistencia.CON_PODER) {
      if (!dto.apoderadoUnidadId) {
        throw new BadRequestException('Indicá qué unidad tiene el poder');
      }
      if (dto.apoderadoUnidadId === unidadId) {
        throw new BadRequestException('Una unidad no puede ser su propia apoderada');
      }
      if (!(await this.asambleas.findAsistencia(id, dto.apoderadoUnidadId))) {
        throw new BadRequestException('La unidad apoderada no está convocada a esta asamblea');
      }
      apoderadoUnidadId = dto.apoderadoUnidadId;
    }

    await this.asambleas.guardarAsistencia(asistencia.id, {
      estado: dto.estado,
      apoderadoUnidadId,
      confirmadaPorId: usuario.id,
      confirmadaAt: new Date(),
    });
    return vistaAsistencia(await this.exigirAsistencia(id, unidadId));
  }

  // ── Privados ───────────────────────────────────────────────────────────────

  private async exigirAsamblea(id: string): Promise<Asamblea> {
    const asamblea = await this.asambleas.findById(id);
    if (!asamblea) throw new NotFoundException(`La asamblea ${id} no existe`);
    return asamblea;
  }

  /** Al vecino, 404 y no 403 para lo que no puede ver: un 403 confirmaría que existe. */
  private async buscarConPermiso(usuario: UsuarioActual, id: string): Promise<Asamblea> {
    const asamblea = await this.exigirAsamblea(id);
    if (esAdmin(usuario)) return asamblea;

    const consorcios = await this.asambleas.consorciosDelUsuario(usuario.id);
    if (asamblea.estado === EstadoAsamblea.BORRADOR || !consorcios.includes(asamblea.consorcioId)) {
      throw new NotFoundException(`La asamblea ${id} no existe`);
    }
    return asamblea;
  }

  private async exigirAsistencia(asambleaId: string, unidadId: string): Promise<Asistencia> {
    const asistencia = await this.asambleas.findAsistencia(asambleaId, unidadId);
    if (!asistencia) {
      throw new NotFoundException('Esa unidad no está convocada a esta asamblea');
    }
    return asistencia;
  }

  /** Si el vecino tiene una sola unidad en el consorcio, se infiere. */
  private async resolverUnidad(usuario: UsuarioActual, consorcioId: string, pedida?: string): Promise<string> {
    const unidades = await this.asambleas.unidadesDelUsuarioEnConsorcio(usuario.id, consorcioId);
    if (pedida) {
      if (!unidades.includes(pedida)) throw new ForbiddenException('Esa unidad no es tuya');
      return pedida;
    }
    if (unidades.length > 1) {
      throw new BadRequestException('Tenés más de una unidad: indicá por cuál respondés');
    }
    if (unidades.length === 0) {
      throw new ForbiddenException('No tenés unidades en este consorcio');
    }
    return unidades[0];
  }

  /** Nunca corta la operación: si el aviso falla, la asamblea ya quedó convocada. */
  private async avisarConvocatoria(asamblea: Asamblea) {
    try {
      const vecinos = await this.asambleas.vecinosDelConsorcio(asamblea.consorcioId);
      const cuando = asamblea.fechaHora.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
      const donde = asamblea.lugar ?? asamblea.linkVideollamada ?? '';
      await Promise.allSettled(
        vecinos.map((destinatarioId) =>
          this.notificador.enviar({
            destinatarioId,
            asunto: `Citación: ${asamblea.titulo}`,
            cuerpo: `Se convocó la asamblea "${asamblea.titulo}" para el ${cuando} en ${donde}. Confirmá tu asistencia desde el portal.`,
            origen: `asamblea:${asamblea.id}`,
          }),
        ),
      );
    } catch (error) {
      this.logger.warn(`No se pudo avisar la convocatoria de ${asamblea.id}: ${String(error)}`);
    }
  }
}

function exigirEstado(asamblea: Asamblea, permitidos: EstadoAsamblea[], accion: string) {
  if (!permitidos.includes(asamblea.estado)) {
    throw new ConflictException(`No se puede ${accion} una asamblea en estado ${asamblea.estado}`);
  }
}

function exigirFechaFutura(fecha: Date) {
  if (Number.isNaN(fecha.getTime()) || fecha.getTime() <= Date.now()) {
    throw new BadRequestException('La fecha de la asamblea tiene que ser futura');
  }
}

/** Presencial pide lugar; digital, link; híbrida, los dos. */
function validarModalidad(
  modalidad: ModalidadAsamblea,
  lugar: string | null | undefined,
  link: string | null | undefined,
) {
  const pideLugar = modalidad !== ModalidadAsamblea.DIGITAL;
  const pideLink = modalidad !== ModalidadAsamblea.PRESENCIAL;
  if (pideLugar && !lugar) {
    throw new BadRequestException(`Una asamblea ${modalidad.toLowerCase()} necesita un lugar`);
  }
  if (pideLink && !link) {
    throw new BadRequestException(`Una asamblea ${modalidad.toLowerCase()} necesita el link de la videollamada`);
  }
}
```

- [ ] **Step 4: Correr y verificar que pasan**

Run: `node --require ts-node/register/transpile-only --test src/modules/asambleas/asambleas.service.spec.ts`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/asambleas/asambleas.service.ts apps/backend/src/modules/asambleas/asambleas.service.spec.ts
git commit -m "feat(asambleas): reglas de ciclo de vida, asistencia y visibilidad

El cierre elige CERRADA o CERRADA_SIN_QUORUM según el quórum para que el
resultado no dependa de lo que marque el administrador, y el vecino sólo
ve asambleas convocadas de sus consorcios."
```

---

### Task 5: Controller, módulo y registro

**Files:**
- Create: `apps/backend/src/modules/asambleas/asambleas.controller.ts`
- Create: `apps/backend/src/modules/asambleas/asambleas.module.ts`
- Modify: `apps/backend/src/app.module.ts` (import y entrada en `imports`, después de `PagosModule`)

- [ ] **Step 1: Controller**

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
import { AsambleasService } from './asambleas.service';
import { CargarActaDto } from './dto/cargar-acta.dto';
import { ConfirmarAsistenciaDto } from './dto/confirmar-asistencia.dto';
import { CreateAsambleaDto } from './dto/create-asamblea.dto';
import { ListarAsambleasQuery } from './dto/listar-asambleas.query';
import { RegistrarAsistenciaDto } from './dto/registrar-asistencia.dto';
import { ReemplazarOrdenDiaDto } from './dto/reemplazar-orden-dia.dto';
import { UpdateAsambleaDto } from './dto/update-asamblea.dto';

/**
 * Un solo controller para los dos portales: el service recorta lo que ve el
 * vecino (sólo asambleas convocadas de sus consorcios).
 */
@ApiTags('asambleas')
@ApiBearerAuth()
@Controller('asambleas')
export class AsambleasController {
  constructor(private readonly asambleas: AsambleasService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista asambleas con su quórum',
    description: 'El administrador ve todas; el vecino, las convocadas de sus consorcios.',
  })
  listar(@UsuarioActual() usuario: Usuario, @Query() query: ListarAsambleasQuery) {
    return this.asambleas.listar(usuario, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle con orden del día y quórum en vivo' })
  @ApiResponse({ status: 404, description: 'No existe o no es visible' })
  findOne(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return this.asambleas.findOne(usuario, id);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Post()
  @ApiOperation({ summary: 'Crea una asamblea en borrador' })
  crear(@UsuarioActual() usuario: Usuario, @Body() dto: CreateAsambleaDto) {
    return this.asambleas.crear(usuario, dto);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Patch(':id')
  @ApiOperation({ summary: 'Edita una asamblea en borrador' })
  editar(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAsambleaDto,
  ) {
    return this.asambleas.editar(usuario, id, dto);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Elimina una asamblea en borrador' })
  eliminar(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return this.asambleas.eliminar(usuario, id);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Put(':id/orden-dia')
  @ApiOperation({ summary: 'Reemplaza el orden del día completo (sólo en borrador)' })
  reemplazarOrdenDia(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReemplazarOrdenDiaDto,
  ) {
    return this.asambleas.reemplazarOrdenDia(usuario, id, dto);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Post(':id/convocar')
  @ApiOperation({
    summary: 'Convoca: arma el padrón de asistencia y avisa a los vecinos',
    description: 'Copia el coeficiente de cada unidad activa al momento de convocar.',
  })
  convocar(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return this.asambleas.convocar(usuario, id);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Post(':id/iniciar')
  @ApiOperation({ summary: 'Pasa a EN_CURSO (no exige quórum)' })
  iniciar(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return this.asambleas.iniciar(usuario, id);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Post(':id/cerrar')
  @ApiOperation({ summary: 'Cierra: CERRADA o CERRADA_SIN_QUORUM según el quórum alcanzado' })
  cerrar(@UsuarioActual() usuario: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return this.asambleas.cerrar(usuario, id);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Patch(':id/acta')
  @ApiOperation({ summary: 'Carga la URL del acta de una asamblea cerrada' })
  cargarActa(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CargarActaDto,
  ) {
    return this.asambleas.cargarActa(usuario, id, dto);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Get(':id/asistencias')
  @ApiOperation({ summary: 'Padrón completo de asistencia' })
  listarAsistencias(@Param('id', ParseUUIDPipe) id: string) {
    return this.asambleas.listarAsistencias(id);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Patch(':id/asistencias/:unidadId')
  @ApiOperation({ summary: 'Registra la asistencia de una unidad (incluye poderes)' })
  registrarAsistencia(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('unidadId', ParseUUIDPipe) unidadId: string,
    @Body() dto: RegistrarAsistenciaDto,
  ) {
    return this.asambleas.registrarAsistencia(usuario, id, unidadId, dto);
  }

  @Roles(RolUsuario.VECINO)
  @Put(':id/asistencia')
  @ApiOperation({
    summary: 'El vecino responde "Asisto" o "No puedo"',
    description: 'La unidad se infiere si tiene una sola en el consorcio.',
  })
  confirmarAsistencia(
    @UsuarioActual() usuario: Usuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmarAsistenciaDto,
  ) {
    return this.asambleas.confirmarAsistencia(usuario, id, dto);
  }
}
```

- [ ] **Step 2: Módulo**

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Asamblea, Asistencia, PuntoOrdenDia, Unidad, UnidadUsuario } from '../../database/entities';
import { ConsorciosModule } from '../consorcios/consorcios.module';
import { AsambleasController } from './asambleas.controller';
import { AsambleasRepository } from './asambleas.repository';
import { AsambleasService } from './asambleas.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Asamblea,
      PuntoOrdenDia,
      Asistencia,
      // Para armar el padrón y saber qué unidades y consorcios ve cada vecino.
      Unidad,
      UnidadUsuario,
    ]),
    // Para validar que el consorcio exista al crear.
    ConsorciosModule,
  ],
  controllers: [AsambleasController],
  providers: [AsambleasService, AsambleasRepository],
  exports: [AsambleasService],
})
export class AsambleasModule {}
```

- [ ] **Step 3: Registrar en `app.module.ts`**

Agregar el import junto a los otros módulos:

```ts
import { AsambleasModule } from './modules/asambleas/asambleas.module';
```

y `AsambleasModule,` en el array `imports`, después de `PagosModule,`.

- [ ] **Step 4: Verificar**

Run: `pnpm exec tsc --noEmit -p tsconfig.json && pnpm test`
Expected: sin errores de tipos; todos los tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/asambleas/asambleas.controller.ts apps/backend/src/modules/asambleas/asambleas.module.ts apps/backend/src/app.module.ts
git commit -m "feat(asambleas): endpoints REST para ambos portales

Un solo controller como en reclamos: las acciones de gestión quedan para
el administrador y la confirmación de asistencia para el vecino."
```

---

### Task 6: Documentación

**Files:**
- Modify: `README.md` (raíz): nueva sección `## Asambleas` después de `## Pagos` (antes de `## Datos de demo`).

- [ ] **Step 1: Agregar la sección**

```markdown
## Asambleas

Módulo `src/modules/asambleas/`. Diseño en
[docs/superpowers/specs/2026-10-02-asambleas-design.md](docs/superpowers/specs/2026-10-02-asambleas-design.md).

### Ciclo

`BORRADOR → CONVOCADA → EN_CURSO → CERRADA | CERRADA_SIN_QUORUM`

- Sólo un borrador se edita, se borra o cambia su orden del día.
- **Convocar** arma el padrón: una asistencia `SIN_RESPONDER` por unidad
  activa, con el coeficiente copiado a ese momento. Avisa a los vecinos.
- **Iniciar** no exige quórum (segunda convocatoria).
- **Cerrar** elige el estado final según el quórum alcanzado.

### Endpoints

| Método | Ruta | Rol |
|---|---|---|
| GET | `/asambleas` | ambos |
| GET | `/asambleas/:id` | ambos |
| POST | `/asambleas` | admin |
| PATCH | `/asambleas/:id` | admin |
| DELETE | `/asambleas/:id` | admin |
| PUT | `/asambleas/:id/orden-dia` | admin |
| POST | `/asambleas/:id/convocar` · `/iniciar` · `/cerrar` | admin |
| PATCH | `/asambleas/:id/acta` | admin |
| GET | `/asambleas/:id/asistencias` | admin |
| PATCH | `/asambleas/:id/asistencias/:unidadId` | admin |
| PUT | `/asambleas/:id/asistencia` | vecino |

### Quórum

Suma de coeficientes `ASISTE` + `CON_PODER` sobre el total convocado
(`quorum.ts`). El vecino responde sólo `ASISTE` / `NO_ASISTE`; los poderes los
registra el administrador indicando la unidad apoderada.

### Pendiente

Votaciones (los puntos `CON_VOTACION` quedan marcados), eventos
`asamblea.creada` / `asamblea.recordatorio` por RabbitMQ y subida del acta.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: sección de asambleas en el README

El README es donde el equipo busca el detalle de cada módulo; sin esto
habría que leer el código para saber qué estados y roles existen."
```

---

### Task 7: Verificación final

- [ ] **Step 1:** `pnpm test` → todos PASS.
- [ ] **Step 2:** `pnpm exec tsc --noEmit -p tsconfig.json` → sin errores.
- [ ] **Step 3:** `pnpm lint` (si existe) → sin errores nuevos.
- [ ] **Step 4:** `pnpm db:verify` (desde la raíz: `pnpm back db:verify`) → pasa. Requiere `.env` con la base; si no hay acceso, dejarlo anotado.
- [ ] **Step 5 (manual, si hay base):** levantar con `pnpm back start:dev`, entrar a Swagger y recorrer: crear → convocar → confirmar como vecino → registrar un poder → iniciar → cerrar → cargar acta.
