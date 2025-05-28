/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: 'http://localhost:4200',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
      preflightContinue: false, // Important: don't continue to next middleware for OPTIONS
      optionsSuccessStatus: 204, // Success status for OPTIONS
    }
  });

  const config = new DocumentBuilder()
    .setTitle('Trip Planner API')
    .setDescription('Backend API for Trip Planner Frontend')
    .setVersion('0.1')
    .addTag('trip')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'jwt',
    )
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory, {
    swaggerOptions: {
      persistAuthorization: true,
      securityDefinitions: {
        bearer: {
          type: 'apiKey',
          name: 'Authorization',
          in: 'header',
          description: 'JWT Authorization header using the Bearer scheme. Example: "Bearer {token}"'
        }
      }
    }
  });

  // Enhanced request timing middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    // Log incoming request immediately
    Logger.debug(`📥 ${req.method} ${req.originalUrl}`, 'RequestStart');

    res.on('finish', () => {
      const duration = Date.now() - start;
      const statusColor = res.statusCode >= 400 ? '🔴' : '🟢';
      Logger.log(`${statusColor} ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`, 'RequestTiming');
    });

    // Fast path for OPTIONS - should be handled by CORS above, but just in case
    if (req.method === 'OPTIONS') {
      const duration = Date.now() - start;
      Logger.debug(`⚡ OPTIONS handled in ${duration}ms`, 'FastOptions');
    }

    next();
  });

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`
  );
  Logger.log(
    `📚 Swagger docs available at: http://localhost:${port}/api`
  );
}

bootstrap();
