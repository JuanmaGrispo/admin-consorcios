import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configurarApp } from './configurar-app';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configurarApp(app);

  const config = app.get(ConfigService);
  const produccion = config.get<string>('NODE_ENV') === 'production';
  const prefix = config.get<string>('API_GLOBAL_PREFIX', '/api');
  const port = config.get<number>('PORT', 4000);
  await app.listen(port, '0.0.0.0');
  Logger.log(
    `backend-consorcios on :${port} · API under ${prefix}${produccion ? '' : ' · docs at /docs'}`,
    'Bootstrap',
  );
}

void bootstrap();
