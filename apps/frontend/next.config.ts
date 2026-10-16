import type { NextConfig } from 'next';

const produccion = process.env.NODE_ENV === 'production';

// El navegador habla con el backend: hay que permitirle conectarse a su origen.
const apiOrigen = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api').origin;
  } catch {
    return '';
  }
})();

// Next inyecta scripts en línea para hidratar, así que sin nonces la CSP tiene
// que admitir 'unsafe-inline'. Aun así corta lo importante: scripts, frames y
// formularios de otros orígenes. En desarrollo hace falta 'unsafe-eval' (HMR).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${produccion ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigen}${produccion ? '' : ' ws: wss:'}`.trim(),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const nextConfig: NextConfig = {
  // No anunciar la tecnología del servidor (X-Powered-By: Next.js).
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'Content-Security-Policy', value: csp },
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
