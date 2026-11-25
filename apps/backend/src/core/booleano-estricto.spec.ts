import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException, ValidationPipe, type ArgumentMetadata } from '@nestjs/common';
import { ActualizarNovedadDto } from '../modules/novedades/dto/actualizar-novedad.dto';
import { UpdateProveedorDto } from '../modules/proveedores/dto/update-proveedor.dto';
import { CreateVotacionDto } from '../modules/votaciones/dto/create-votacion.dto';
import { BooleanoEstricto } from './booleano-estricto';

/** Las mismas opciones que el pipe global de configurar-app.ts. */
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

const validar = <T>(metatype: new () => T, body: unknown): Promise<T> =>
  pipe.transform(body, { type: 'body', metatype } as ArgumentMetadata) as Promise<T>;

class ConFlag {
  @BooleanoEstricto()
  flag!: boolean;
}

describe('BooleanoEstricto (DEF-15)', () => {
  it('deja pasar true y false reales sin cambiarlos', async () => {
    assert.equal((await validar(ConFlag, { flag: true })).flag, true);
    assert.equal((await validar(ConFlag, { flag: false })).flag, false);
  });

  // Antes "false" llegaba como true por la conversión implícita y se guardaba al revés.
  for (const valor of ['false', 'true', 'si', 'no', '0', '1', 0, 1, null]) {
    it(`rechaza ${JSON.stringify(valor)} con 400`, async () => {
      await assert.rejects(validar(ConFlag, { flag: valor }), BadRequestException);
    });
  }

  it('PATCH /novedades/:id con {"fijada":"false"} es 400 y no fija la novedad', async () => {
    await assert.rejects(validar(ActualizarNovedadDto, { fijada: 'false' }), BadRequestException);
    await assert.rejects(validar(ActualizarNovedadDto, { activa: 'false' }), BadRequestException);
    const ok = await validar(ActualizarNovedadDto, { fijada: false });
    assert.equal(ok.fijada, false);
  });

  it('el proveedor no acepta activo "si"', async () => {
    await assert.rejects(validar(UpdateProveedorDto, { activo: 'si' }), BadRequestException);
  });

  it('un campo booleano opcional ausente sigue siendo opcional', async () => {
    const dto = await validar(ActualizarNovedadDto, { titulo: 'Corte de agua' });
    assert.equal(dto.fijada, undefined);
  });

  it('en una votación, los flags con texto son 400', async () => {
    for (const campo of ['permiteVotoAnticipado', 'mostrarParcial']) {
      const error = await validar(CreateVotacionDto, { [campo]: 'false' }).catch((e: unknown) => e);
      assert.ok(error instanceof BadRequestException, campo);
      const mensajes = JSON.stringify(error.getResponse());
      assert.match(mensajes, new RegExp(`${campo} must be a boolean value`), campo);
    }
  });
});
