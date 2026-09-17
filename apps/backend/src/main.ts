import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  const config = app.get(ConfigService);

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

  const swagger = new DocumentBuilder()
    .setTitle('backend-consorcios')
    .setDescription('Sistema de administración de consorcios')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger), {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = config.get<number>('PORT', 4000);
  await app.listen(port, '0.0.0.0');
  Logger.log(`backend-consorcios on :${port} · API under ${prefix} · docs at /docs`, 'Bootstrap');
}

void bootstrap();
