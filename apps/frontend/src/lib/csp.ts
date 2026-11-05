import { createHash } from 'node:crypto';

// Estilos SSR fijos de next/image, la barra lateral shadcn y las páginas de
// error de Next 16.4.1. Solo se autorizan estos valores completos, no CSS libre.
const estilosSSR = [
  'color:transparent',
  'position:absolute;height:100%;width:100%;left:0;top:0;right:0;bottom:0;color:transparent',
  '--sidebar-width:16rem;--sidebar-width-icon:3rem',
  'font-family:system-ui,"Segoe UI",Roboto,Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji";height:100vh;display:flex;align-items:center;justify-content:center',
  'margin-top:-32px;max-width:325px;padding:32px 28px;text-align:left',
  'margin-bottom:24px',
  'font-size:24px;font-weight:500;letter-spacing:-0.02em;line-height:32px;margin:0 0 12px 0;color:var(--next-error-title)',
  'font-size:14px;font-weight:400;line-height:21px;margin:0 0 20px 0;color:var(--next-error-message)',
  'margin:0',
  'display:inline-flex;align-items:center;justify-content:center;height:32px;padding:0 12px;font-size:14px;font-weight:500;line-height:20px;border-radius:6px;cursor:pointer;color:var(--next-error-btn-text);background:var(--next-error-btn-bg);border:var(--next-error-btn-border)',
  'font-family:system-ui,"Segoe UI",Roboto,Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji";height:100vh;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center',
  'display:inline-block;margin:0 20px 0 0;padding:0 23px 0 0;font-size:24px;font-weight:500;vertical-align:top;line-height:49px',
  'display:inline-block',
  'font-size:14px;font-weight:400;line-height:49px;margin:0',
];
const hashesSSR = estilosSSR.map((css) => `'sha256-${createHash('sha256').update(css).digest('base64')}'`).join(' ');

function origen(valor: string | undefined): string {
  if (!valor) return '';
  const url = new URL(valor);
  const local = ['localhost', '127.0.0.1', 'host.docker.internal'].includes(url.hostname);
  if (url.username || url.password || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) {
    throw new Error('La CSP requiere un origen HTTPS o HTTP local, sin credenciales');
  }
  return url.origin;
}

export function politicaCsp(nonce: string): string {
  const desarrollo = process.env.NODE_ENV !== 'production';
  const api = origen(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api');
  const storage = origen(process.env.NEXT_PUBLIC_STORAGE_URL);
  const sonner = process.env.SONNER_STYLE_HASH;
  // Sonner agrega primero un <style> vacío y después su contenido fijo. Cada
  // estado tiene su hash; ninguno autoriza CSS distinto del contenido aprobado.
  const hojaVacia = `'sha256-${createHash('sha256').update('').digest('base64')}'`;
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${desarrollo ? " 'unsafe-eval'" : ''}`,
    "script-src-attr 'none'",
    `style-src 'self' 'report-sample' ${desarrollo ? "'unsafe-inline'" : `'nonce-${nonce}' ${hojaVacia}${sonner ? ` '${sonner}'` : ''}`}`,
    desarrollo ? "style-src-attr 'unsafe-inline'" : `style-src-attr 'unsafe-hashes' ${hashesSSR}`,
    `img-src 'self' data: blob: ${storage}`.trim(),
    "font-src 'self'",
    `connect-src 'self' ${api}${desarrollo ? ' ws: wss:' : ''}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}
