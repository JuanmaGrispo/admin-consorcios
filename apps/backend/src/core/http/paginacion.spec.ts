import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ListarNotificacionesQuery } from '../../modules/bandeja/dto/listar-notificaciones.query';
import { ListarBoletasQuery } from '../../modules/expensas/dto/listar-boletas.query';
import { ListarNovedadesQuery } from '../../modules/novedades/dto/listar-novedades.query';
import { ListarReclamosQuery } from '../../modules/reclamos/dto/listar-reclamos.query';
import { ListarReservasQuery } from '../../modules/reservas/dto/listar-reservas.query';
import { PAGINA_MAXIMA } from './contratos-rest';

// Mismas opciones que configurar-app.ts: así se valida un query en la API real.
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});
const validar = (metatype: new () => object, pagina: string) =>
  pipe.transform({ pagina }, { type: 'query', metatype });

const listados = {
  reclamos: ListarReclamosQuery,
  novedades: ListarNovedadesQuery,
  boletas: ListarBoletasQuery,
  reservas: ListarReservasQuery,
  notificaciones: ListarNotificacionesQuery,
};

// DEF-16: sin tope, una página enorme desbordaba el OFFSET de PostgreSQL y respondía 500.
describe('pagina de los listados paginados', () => {
  for (const [nombre, dto] of Object.entries(listados)) {
    it(`${nombre}: acepta la última página permitida`, async () => {
      const query = (await validar(dto, String(PAGINA_MAXIMA))) as { pagina: number };
      assert.equal(query.pagina, PAGINA_MAXIMA);
    });

    it(`${nombre}: rechaza con 400 la página siguiente al tope`, async () => {
      await assert.rejects(validar(dto, String(PAGINA_MAXIMA + 1)), BadRequestException);
    });

    it(`${nombre}: rechaza con 400 una página que desborda bigint`, async () => {
      await assert.rejects(validar(dto, '9223372036854775808'), BadRequestException);
    });
  }
});
