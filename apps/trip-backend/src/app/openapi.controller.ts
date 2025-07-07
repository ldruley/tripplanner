import { Controller, Get } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { NestFactory } from '@nestjs/core';
import { patchNestjsSwagger } from '@anatine/zod-nestjs';

@Controller('openapi')
export class OpenApiController {
  private cachedDocument: any = null;

  @Get('json')
  async getOpenApiJson() {
    // Return cached document if available to avoid recreating it on every request
    if (this.cachedDocument) {
      return this.cachedDocument;
    }

    // Create a temporary app instance to generate the document
    const app = await NestFactory.create(AppModule, { logger: false });

    // Create the same config as in main.ts
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

    // Patch NestJS Swagger to work with Zod schemas
    patchNestjsSwagger();

    // Create the OpenAPI document
    const document = SwaggerModule.createDocument(app, config);
    
    // Cache the document
    this.cachedDocument = document;

    // Close the temporary app
    await app.close();

    return document;
  }
}