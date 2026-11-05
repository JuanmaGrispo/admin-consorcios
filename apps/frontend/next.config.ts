import path from 'node:path';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { NextConfig } from 'next';

// Sonner 2 inyecta una hoja fija al cargar su módulo. Su hash permite esa hoja
// concreta; no habilita cualquier <style>. Se recalcula al cambiar la librería.
const sonnerSource = readFileSync(path.join(__dirname, 'node_modules/sonner/dist/index.mjs'), 'utf8');
const cssLiteral = sonnerSource.match(/__insertCSS\(("(?:[^"\\]|\\.)*")\)/)?.[1];
if (!cssLiteral) throw new Error('Revisar la integración CSP: cambió la inyección CSS de Sonner');
const sonnerHash = 'sha256-' + createHash('sha256').update(JSON.parse(cssLiteral)).digest('base64');

const nextConfig: NextConfig = {
  env: { SONNER_STYLE_HASH: sonnerHash },
  // Build autocontenido (.next/standalone) para la imagen de Docker. No cambia
  // nada en `pnpm dev`. La raíz del monorepo hace falta para que el tracing
  // encuentre las dependencias que pnpm deja en node_modules de la raíz.
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // No anunciar la tecnología del servidor (X-Powered-By: Next.js).
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
