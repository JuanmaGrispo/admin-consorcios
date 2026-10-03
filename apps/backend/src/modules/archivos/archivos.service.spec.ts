import { BadRequestException, ForbiddenException } from '@nestjs/common';
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { RolUsuario } from '../../database/entities';
import type { UsuarioActual } from '../auth/auth.types';
import type { ArchivosClient } from './archivos.client';
import { ArchivosService, type ArchivoSubido } from './archivos.service';
import { DestinoArchivo, TipoArchivo } from './tipos-archivo';

const admin: UsuarioActual = { id: 'a1', email: 'a@x', rol: RolUsuario.ADMINISTRADOR };
const vecino: UsuarioActual = { id: 'v1', email: 'v@x', rol: RolUsuario.VECINO };

const PREFIJO = 'https://proyecto.supabase.co/storage/v1/object/public/domus/';

const jpeg = (bytes = 32) =>
  Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(bytes)]);
const pdf = () => Buffer.concat([Buffer.from('%PDF-1.7', 'ascii'), Buffer.alloc(32)]);

const comoArchivo = (buffer: Buffer, mimetype = 'image/jpeg'): ArchivoSubido => ({
  buffer,
  mimetype,
  originalname: 'foto.jpg',
  size: buffer.length,
});

function crearEntorno() {
  const subidos: { ruta: string; tipo: TipoArchivo }[] = [];
  const borrados: string[] = [];

  const storage = {
    subir: async (ruta: string, _c: Buffer, tipo: TipoArchivo) => {
      subidos.push({ ruta, tipo });
      return `${PREFIJO}${ruta}`;
    },
    borrar: async (ruta: string) => { borrados.push(ruta); },
    rutaDeUrl: (url: string) => (url.startsWith(PREFIJO) ? url.slice(PREFIJO.length) : null),
  } as unknown as ArchivosClient;

  return { storage, subidos, borrados };
}

describe('ArchivosService', () => {
  let entorno: ReturnType<typeof crearEntorno>;
  let service: ArchivosService;

  beforeEach(() => {
    entorno = crearEntorno();
    service = new ArchivosService(entorno.storage);
  });

  describe('subir', () => {
    it('guarda la foto y devuelve su URL', async () => {
      const r = await service.subir(vecino, DestinoArchivo.RECLAMOS, comoArchivo(jpeg()));
      assert.equal(r.tipo, TipoArchivo.JPEG);
      assert.ok(r.url.startsWith(PREFIJO));
      assert.ok(r.url.endsWith('.jpg'));
    });

    it('la ruta lleva destino, dueño y un uuid, nunca el nombre original', async () => {
      const r = await service.subir(
        vecino,
        DestinoArchivo.RECLAMOS,
        { ...comoArchivo(jpeg()), originalname: '../../etc/passwd' },
      );
      const [destino, dueño, nombre] = r.ruta.split('/');
      assert.equal(destino, 'reclamos');
      assert.equal(dueño, 'v1');
      assert.match(nombre, /^[0-9a-f-]{36}\.jpg$/);
      assert.ok(!r.ruta.includes('passwd'));
    });

    it('dos subidas del mismo archivo no se pisan', async () => {
      const a = await service.subir(vecino, DestinoArchivo.RECLAMOS, comoArchivo(jpeg()));
      const b = await service.subir(vecino, DestinoArchivo.RECLAMOS, comoArchivo(jpeg()));
      assert.notEqual(a.ruta, b.ruta);
    });

    it('no cree en el Content-Type: vale lo que dicen los bytes', async () => {
      // Se declara imagen, pero es un PDF. Va a reclamos, que no acepta PDF.
      await assert.rejects(
        service.subir(vecino, DestinoArchivo.RECLAMOS, comoArchivo(pdf(), 'image/jpeg')),
        BadRequestException,
      );
      assert.equal(entorno.subidos.length, 0);
    });

    it('un tipo que no reconocemos no entra', async () => {
      const elf = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01]);
      await assert.rejects(
        service.subir(admin, DestinoArchivo.COMPROBANTES, comoArchivo(elf)),
        BadRequestException,
      );
    });

    it('respeta el tamaño de cada destino', async () => {
      // 3 MB entra en reclamos (8 MB) pero no en avatares (2 MB).
      const grande = jpeg(3 * 1024 * 1024);
      await service.subir(vecino, DestinoArchivo.RECLAMOS, comoArchivo(grande));
      await assert.rejects(
        service.subir(vecino, DestinoArchivo.AVATARES, comoArchivo(grande)),
        BadRequestException,
      );
    });

    it('el vecino no sube comprobantes de gastos', async () => {
      await assert.rejects(
        service.subir(vecino, DestinoArchivo.COMPROBANTES, comoArchivo(pdf())),
        ForbiddenException,
      );
    });

    it('el administrador sí, y en PDF', async () => {
      const r = await service.subir(admin, DestinoArchivo.COMPROBANTES, comoArchivo(pdf()));
      assert.equal(r.tipo, TipoArchivo.PDF);
      assert.ok(r.url.endsWith('.pdf'));
    });

    it('un acta sólo acepta PDF, ni siquiera del administrador', async () => {
      await assert.rejects(
        service.subir(admin, DestinoArchivo.ACTAS, comoArchivo(jpeg())),
        BadRequestException,
      );
    });

    it('sin archivo, lo dice', async () => {
      await assert.rejects(
        service.subir(vecino, DestinoArchivo.RECLAMOS, undefined),
        BadRequestException,
      );
      await assert.rejects(
        service.subir(vecino, DestinoArchivo.RECLAMOS, comoArchivo(Buffer.alloc(0))),
        BadRequestException,
      );
    });
  });

  describe('borrar', () => {
    it('el dueño borra la suya', async () => {
      const { url, ruta } = await service.subir(
        vecino,
        DestinoArchivo.RECLAMOS,
        comoArchivo(jpeg()),
      );
      await service.borrar(vecino, url);
      assert.deepEqual(entorno.borrados, [ruta]);
    });

    it('el vecino no borra la de otro', async () => {
      await assert.rejects(
        service.borrar(vecino, `${PREFIJO}reclamos/otro-vecino/abc.jpg`),
        BadRequestException,
      );
      assert.equal(entorno.borrados.length, 0);
    });

    it('el administrador borra cualquiera', async () => {
      await service.borrar(admin, `${PREFIJO}reclamos/otro-vecino/abc.jpg`);
      assert.deepEqual(entorno.borrados, ['reclamos/otro-vecino/abc.jpg']);
    });

    it('una URL ajena al bucket no se toca', async () => {
      await assert.rejects(
        service.borrar(admin, 'https://otro-sitio.com/archivo.jpg'),
        BadRequestException,
      );
      assert.equal(entorno.borrados.length, 0);
    });
  });

  describe('exigirPropia', () => {
    it('acepta una URL nuestra del destino pedido', () => {
      assert.doesNotThrow(() =>
        service.exigirPropia(`${PREFIJO}actas/a1/x.pdf`, DestinoArchivo.ACTAS),
      );
    });

    it('rechaza una URL de otro destino', () => {
      assert.throws(
        () => service.exigirPropia(`${PREFIJO}reclamos/v1/x.jpg`, DestinoArchivo.ACTAS),
        BadRequestException,
      );
    });

    it('rechaza una URL externa', () => {
      assert.throws(
        () => service.exigirPropia('https://otro.com/actas/x.pdf', DestinoArchivo.ACTAS),
        BadRequestException,
      );
    });
  });
});
