import { JwtService } from '@nestjs/jwt';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';
import { emisorJwt, JWT_ALGORITMO, opcionesJwt } from './jwt.opciones';
import { JwtStrategy } from './jwt.strategy';

const SECRETO = 'secreto-de-prueba-con-largo-suficiente-para-hs256';
const valores: Record<string, string> = { JWT_SECRET: SECRETO, JWT_EXPIRES_IN: '1h' };
const config = {
  get: <T>(clave: string, defecto?: T) => (valores[clave] ?? defecto) as T,
  getOrThrow: <T>(clave: string) => {
    if (!(clave in valores)) throw new Error(`Falta ${clave}`);
    return valores[clave] as T;
  },
};

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const ahora = () => Math.floor(Date.now() / 1000);
const carga = (extra: object = {}) => ({ sub: 'u-1', email: 'a@domus.test', rol: 'VECINO', iat: ahora(), exp: ahora() + 600, iss: 'domus', ...extra });

/** Arma el token a mano para poder falsificar cabecera, firma y claims. */
function token(payload: object, { alg = 'HS256', secreto = SECRETO }: { alg?: string; secreto?: string } = {}): string {
  const cuerpo = `${b64({ alg, typ: 'JWT' })}.${b64(payload)}`;
  if (alg === 'none') return `${cuerpo}.`;
  const hmac = alg === 'HS512' ? 'sha512' : alg === 'HS384' ? 'sha384' : 'sha256';
  return `${cuerpo}.${createHmac(hmac, secreto).update(cuerpo).digest('base64url')}`;
}

describe('opciones del JWT', () => {
  const jwt = new JwtService(opcionesJwt(config));

  it('firma con HS256 y el emisor domus, y lo verifica', () => {
    const firmado = jwt.sign({ sub: 'u-1', email: 'a@domus.test', rol: 'VECINO' });
    const [cabecera] = firmado.split('.');
    assert.equal(JSON.parse(Buffer.from(cabecera, 'base64url').toString()).alg, 'HS256');
    const verificado = jwt.verify<{ iss: string; sub: string }>(firmado);
    assert.equal(verificado.iss, 'domus');
    assert.equal(verificado.sub, 'u-1');
  });

  it('acepta un token armado a mano válido (control de la falsificación)', () => {
    assert.equal(jwt.verify<{ sub: string }>(token(carga())).sub, 'u-1');
  });

  it('rechaza un token vencido', () => {
    assert.throws(() => jwt.verify(token(carga({ iat: ahora() - 7200, exp: ahora() - 3600 }))), /expired/);
  });

  it('rechaza un token con la firma alterada', () => {
    const valido = token(carga());
    const alterado = valido.slice(0, -2) + (valido.endsWith('AA') ? 'BB' : 'AA');
    assert.throws(() => jwt.verify(alterado), /signature/);
    assert.throws(() => jwt.verify(token(carga(), { secreto: 'otro-secreto' })), /signature/);
  });

  it('rechaza un payload modificado con la firma original (escalada de rol)', () => {
    const [cabecera, , firma] = token(carga()).split('.');
    assert.throws(() => jwt.verify(`${cabecera}.${b64(carga({ rol: 'SUPER_ADMIN' }))}.${firma}`), /signature/);
  });

  it('rechaza alg=none', () => {
    assert.throws(() => jwt.verify(token(carga(), { alg: 'none' })));
  });

  it('rechaza otro algoritmo aunque la firma con el mismo secreto sea correcta', () => {
    assert.throws(() => jwt.verify(token(carga(), { alg: 'HS512' })), /algorithm/);
  });

  it('rechaza un token de otro emisor o sin emisor', () => {
    assert.throws(() => jwt.verify(token(carga({ iss: 'otro-emisor' }))), /issuer/);
    const sinEmisor: Record<string, unknown> = carga();
    delete sinEmisor.iss;
    assert.throws(() => jwt.verify(token(sinEmisor)), /issuer/);
  });

  it('el emisor se puede configurar y por defecto es domus', () => {
    assert.equal(emisorJwt({ get: () => undefined }), 'domus');
    assert.equal(emisorJwt({ get: () => 'domus-prod' } as never), 'domus-prod');
  });

  it('sin JWT_SECRET la configuración falla en lugar de usar un default', () => {
    assert.throws(() => opcionesJwt({ ...config, getOrThrow: () => { throw new Error('Falta JWT_SECRET'); } }), /JWT_SECRET/);
  });
});

describe('JwtStrategy', () => {
  it('Passport verifica con el mismo algoritmo y emisor que la firma', () => {
    const estrategia = new JwtStrategy(config as never, {} as never) as unknown as {
      _verifOpts: { algorithms?: string[]; issuer?: string; ignoreExpiration?: boolean };
    };
    assert.deepEqual(estrategia._verifOpts.algorithms, [JWT_ALGORITMO]);
    assert.equal(estrategia._verifOpts.issuer, 'domus');
    assert.equal(estrategia._verifOpts.ignoreExpiration, false);
  });
});
