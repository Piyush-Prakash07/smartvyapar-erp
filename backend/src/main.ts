import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { Express } from 'express';
import { validateEnvironment } from './common/config/env.validation';

async function bootstrap() {
  // Validate critical environment variables on startup
  validateEnvironment();

  const app = await NestFactory.create(AppModule);

  // Trust reverse proxy headers (for accurate client IP detection in rate limiting behind Render/Railway/Nginx)
  const trustProxy = process.env.TRUST_PROXY ?? '1';
  const expressApp = app.getHttpAdapter().getInstance() as Express;
  if (expressApp && typeof expressApp.set === 'function') {
    expressApp.set(
      'trust proxy',
      trustProxy === 'true' ? true : Number(trustProxy) || 1,
    );
  }

  // Apply production-safe Helmet HTTP security headers
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allows cross-origin PDF blob loading and asset sharing
      contentSecurityPolicy: false, // Let React frontend and CSP headers manage their own directives to avoid breaking inline scripts / blob URLs
    }),
  );

  // Enable Global validation piping
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Set global endpoint prefix with root health check exclusion
  app.setGlobalPrefix('api/v1', {
    exclude: ['health', '/'],
  });

  // Enable cookie parser middleware
  app.use(cookieParser());

  // Production-safe CORS with multi-origin (FRONTEND_URL / FRONTEND_URLS) and development fallback
  const rawOrigins =
    `${process.env.FRONTEND_URL || ''},${process.env.FRONTEND_URLS || ''}`
      .split(',')
      .map((o) => o.trim().replace(/\/$/, ''))
      .filter(Boolean);

  const allowedOrigins =
    rawOrigins.length > 0
      ? rawOrigins
      : [
          'http://localhost:5173',
          'http://localhost:3000',
          'http://127.0.0.1:5173',
          'http://localhost:4173',
        ];

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server, health checks)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        process.env.NODE_ENV !== 'production' ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:')
      ) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    exposedHeaders: ['set-cookie'],
  });

  const port = process.env.PORT || 5000;
  await app.listen(port);
  console.log(`NestJS Backend API listening on port ${port}`);
}
void bootstrap();
