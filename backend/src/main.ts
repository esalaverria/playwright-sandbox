import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
  app.enableCors({
    origin: config.get<string>('WEB_ORIGIN', 'http://localhost:3000'),
    credentials: true,
  });
  app.setGlobalPrefix('api');

  const swaggerEnabled = config.get<string>('SWAGGER_ENABLED', 'true') !== 'false';
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('NorthPeak API')
      .setDescription('NorthPeak sandbox API (Playwright testing target).')
      .setVersion('1.0.0')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
    // OpenAPI JSON will be available at /api/docs-json (default swagger-ui-express behavior is /api-json,
    // so we expose a stable path ourselves).
    app.use('/api/docs-json', (_req: Request, res: Response) => res.json(document));
  }
  const port = Number(config.get<string>('PORT', '4000'));
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}/api`);
}

bootstrap();
