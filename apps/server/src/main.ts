import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // Security headers — applied before anything else
  app.use(helmet());
  // Cookie parser — required for httpOnly refresh token cookies
  app.use(cookieParser());

  // All routes live under /api/v1
  app.setGlobalPrefix('api/v1');

  // CORS — only allow configured origin
  const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
  app.enableCors({
    origin: clientOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global validation pipe
  // whitelist: strips properties not declared in DTO
  // forbidNonWhitelisted: throws if unknown properties are sent
  // transform: auto-converts plain objects to DTO class instances
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);

  logger.log(`Server running  → http://localhost:${port}/api/v1`);
  logger.log(`Health check   → http://localhost:${port}/api/v1/health`);
  logger.log(`Environment    → ${process.env.NODE_ENV ?? 'development'}`);
}

bootstrap().catch((err: unknown) => {
  console.error('Fatal: failed to start server', err);
  process.exit(1);
});
