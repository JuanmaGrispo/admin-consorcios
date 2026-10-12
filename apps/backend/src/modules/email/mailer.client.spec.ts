import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { opcionesSmtp } from './mailer.client';

const desde = (valores: Record<string, string>) => (nombre: string) => valores[nombre];

describe('opcionesSmtp', () => {
  it('reutiliza una sola conexión: Gmail corta si hay un login por mail', () => {
    const opciones = opcionesSmtp(desde({ SMTP_HOST: 'smtp.gmail.com', SMTP_PORT: '587' }));
    assert.equal(opciones.pool, true);
    assert.equal(opciones.maxConnections, 1);
    assert.equal(opciones.secure, false);
  });

  it('el 465 es TLS directo', () => {
    assert.equal(opcionesSmtp(desde({ SMTP_PORT: '465' })).secure, true);
  });

  it('un puerto vacío en el .env usa el 587', () => {
    assert.equal(opcionesSmtp(desde({ SMTP_PORT: '' })).port, 587);
  });
});
