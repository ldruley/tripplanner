/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: ['http://localhost:4200', 'http://127.0.0.1:4200'],
    credentials: true,
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
      persistAuthorization: true, // Keep auth between page refreshes
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

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`
  );
}

bootstrap();
