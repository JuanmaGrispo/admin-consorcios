import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { FiltroExcepciones } from './core/http/filtro-excepciones';

/**
 * Todo lo que configura la app HTTP (cabeceras, filtros, validación, CORS,
 * Swagger). Vive aparte de main.ts para poder probarlo sin levantar la base.
 */
export function configurarApp(app: NestExpressApplication): void {
  const config = app.get(ConfigService);
  const produccion = config.get<string>('NODE_ENV') === 'production';

  // Detrás de un proxy o balanceador la IP real viene en X-Forwarded-For. Sin
  // esto el límite de login vería una sola IP para todos. TRUST_PROXY es la
  // cantidad de proxies (1) o una lista de IPs/subredes.
  const proxy = config.get<string>('TRUST_PROXY');
  if (proxy) app.set('trust proxy', /^\d+$/.test(proxy) ? Number(proxy) : proxy);

  // No anunciar la tecnología del servidor.
  app.disable('x-powered-by');

  // Cabeceras de seguridad (HSTS, nosniff, CSP…). La CSP se apaga fuera de
  // producción porque Swagger UI usa scripts en línea. Esta API sirve JSON y
  // PDF a un front de otro origen (el que autoriza CORS), así que sus recursos
  // tienen que poder cargarse cross-origin.
  app.use(
    helmet({
      contentSecurityPolicy: produccion ? undefined : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Las respuestas llevan datos personales: que el navegador no las guarde.
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // 405 para un método no previsto, 500 genérico con id de correlación y log de 401/403.
  app.useGlobalFilters(new FiltroExcepciones());

  // La sesión viaja en una cookie httpOnly, así que el guard necesita las
  // cookies parseadas antes de llegar a cualquier ruta. Acá no se firma nada:
  // lo firmado es el JWT que va adentro.
  app.use(cookieParser());

  // Validación de borde. `forbidNonWhitelisted` hace que un campo inesperado sea un
  // error y no algo ignorado en silencio — un typo en un cliente tiene que hacer ruido.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Cierra los pools de conexión en SIGTERM/SIGINT en vez de cortarlos.
  app.enableShutdownHooks();

  app.enableCors({
    origin: (config.get<string>('CORS_ORIGINS') || 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    credentials: true,
  });

  const prefix = config.get<string>('API_GLOBAL_PREFIX', '/api');

  // Seteado antes de armar el doc de OpenAPI para que las rutas documentadas lo incluyan.
  app.setGlobalPrefix(prefix);

  // Swagger sólo fuera de producción: allá /docs responde 404.
  if (!produccion) {
    const swagger = new DocumentBuilder()
      .setTitle('backend-consorcios')
      .setDescription('Sistema de administración de consorcios')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger), {
      swaggerOptions: { persistAuthorization: true },
    });
  }
}
