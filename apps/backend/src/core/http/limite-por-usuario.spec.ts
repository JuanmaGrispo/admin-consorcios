import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HttpException, HttpStatus, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ArchivosController } from '../../modules/archivos/archivos.controller';
import { ExpensasController } from '../../modules/expensas/expensas.controller';
import { ReclamosController } from '../../modules/reclamos/reclamos.controller';
import { UnidadesController } from '../../modules/unidades/unidades.controller';
import { ContadorPorUsuario, LIMITES, LimitePorUsuarioGuard, type GrupoLimitado } from './limite-por-usuario';

describe('ContadorPorUsuario (DIS01)', () => {
  const limite = { maximo: 3, ventanaMs: 10_000 };

  it('deja pasar hasta el máximo y frena el siguiente con los segundos de espera', () => {
    let ahora = 0;
    const contador = new ContadorPorUsuario(() => ahora);
    for (let i = 0; i < 3; i++) assert.equal(contador.registrar('u1', limite), null);
    ahora = 4_000;
    assert.equal(contador.registrar('u1', limite), 6);
  });

  it('libera el lugar cuando el pedido más viejo sale de la ventana', () => {
    let ahora = 0;
    const contador = new ContadorPorUsuario(() => ahora);
    for (let i = 0; i < 3; i++) contador.registrar('u1', limite);
    ahora = 9_999;
    assert.notEqual(contador.registrar('u1', limite), null);
    ahora = 10_000;
    assert.equal(contador.registrar('u1', limite), null);
  });

  it('los pedidos rechazados no alargan el bloqueo', () => {
    let ahora = 0;
    const contador = new ContadorPorUsuario(() => ahora);
    for (let i = 0; i < 3; i++) contador.registrar('u1', limite);
    for (let i = 0; i < 50; i++) contador.registrar('u1', limite);
    ahora = 10_000;
    assert.equal(contador.registrar('u1', limite), null);
  });

  it('cada usuario tiene su propio cupo', () => {
    const contador = new ContadorPorUsuario(() => 0);
    for (let i = 0; i < 3; i++) contador.registrar('u1', limite);
    assert.notEqual(contador.registrar('u1', limite), null);
    assert.equal(contador.registrar('u2', limite), null);
  });
});

describe('LimitePorUsuarioGuard (DIS01)', () => {
  const contexto = (handler: object, usuario?: { id: string }) =>
    ({
      getHandler: () => handler,
      switchToHttp: () => ({ getRequest: () => ({ user: usuario }) }),
    }) as unknown as ExecutionContext;

  const guard = () => {
    const g = new LimitePorUsuarioGuard(new Reflector());
    g.contador = new ContadorPorUsuario(() => 0);
    return g;
  };

  it('el alta de reclamos responde 429 con Retry-After al pasar el límite', () => {
    const g = guard();
    const handler = ReclamosController.prototype.crear;
    for (let i = 0; i < LIMITES.reclamos.maximo; i++) assert.ok(g.canActivate(contexto(handler, { id: 'v1' })));
    assert.throws(
      () => g.canActivate(contexto(handler, { id: 'v1' })),
      (e: HttpException) => {
        assert.equal(e.getStatus(), HttpStatus.TOO_MANY_REQUESTS);
        assert.equal((e.getResponse() as { retryAfter: number }).retryAfter, LIMITES.reclamos.ventanaMs / 1000);
        return true;
      },
    );
    // Otro vecino no queda afectado.
    assert.ok(g.canActivate(contexto(handler, { id: 'v2' })));
  });

  it('un endpoint sin límite no cuenta nada', () => {
    const g = guard();
    const handler = ReclamosController.prototype.listar;
    for (let i = 0; i < 100; i++) assert.ok(g.canActivate(contexto(handler, { id: 'v1' })));
  });

  // Si alguien saca el decorador de un endpoint costoso, este test lo marca.
  const esperados: [string, object, GrupoLimitado][] = [
    ['POST /reclamos', ReclamosController.prototype.crear, 'reclamos'],
    ['POST /archivos', ArchivosController.prototype.subir, 'archivos'],
    ['GET /liquidaciones/:id/exportar', ExpensasController.prototype.exportarLiquidacion, 'exportaciones'],
    ['GET /boletas/exportar', ExpensasController.prototype.exportarCobranzas, 'exportaciones'],
    ['POST /boletas/recordatorios', ExpensasController.prototype.enviarRecordatorios, 'recordatorios'],
    ['GET /unidades/exportar', UnidadesController.prototype.exportarPadron, 'exportaciones'],
  ];
  for (const [ruta, handler, grupo] of esperados) {
    it(`${ruta} está limitado (${grupo}: ${LIMITES[grupo].maximo} por ${LIMITES[grupo].ventanaMs / 1000} s)`, () => {
      assert.equal(typeof handler, 'function', `${ruta}: no se encontró el método del controller`);
      const g = guard();
      for (let i = 0; i < LIMITES[grupo].maximo; i++) g.canActivate(contexto(handler, { id: 'u' }));
      assert.throws(() => g.canActivate(contexto(handler, { id: 'u' })), HttpException);
    });
  }
});
