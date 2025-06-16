import {
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger, BadRequestException
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { ZodError, ZodIssue } from 'zod';
import { ErrorResponse } from '@trip-planner/types';
import { Response } from 'express';
import { Prisma } from '@prisma/client';

export interface ZodFieldError {
  field: string;
  message: string;
  code: string;
  received?: any;
}

@Catch()
export class GlobalExceptionsFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorResponse = this.buildErrorResponse(exception, request);

    if (errorResponse.statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : exception,
      );
    } else if (errorResponse.statusCode >= 400 && errorResponse.statusCode < 500) {
      this.logger.warn(
        `${request.method} ${request.url} - ${errorResponse.error}`,
      );
    }
  }

  private buildErrorResponse(exception: unknown, request: Request): ErrorResponse {
    const timestamp = new Date().toISOString();
    const path = request.url;

    // Handle Zod validation errors
    if (exception instanceof ZodError) {
      return {
        success: false,
        error: 'Validation Error',
        message: 'The provided data does not meet the required format',
        details: {
          fields: this.formatZodErrors(exception.issues),
          raw: exception.issues, // Include raw for debugging
        },
        timestamp,
        path,
        statusCode: HttpStatus.BAD_REQUEST,
      };
    }

    // Handle NestJS HTTP exceptions
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // Handle BadRequestException from ZodValidationPipe
      if (exception instanceof BadRequestException && typeof exceptionResponse === 'object') {
        const response = exceptionResponse as any;

        // Check if it's from ZodValidationPipe
        if (response.message && Array.isArray(response.message)) {
          return {
            success: false,
            error: 'Validation Error',
            message: 'Request validation failed',
            details: {
              fields: this.parseZodValidationPipeErrors(response.message),
            },
            timestamp,
            path,
            statusCode: status,
          };
        }

        return {
          success: false,
          error: typeof exceptionResponse === 'string' ? exceptionResponse : exception.message,
          message: typeof exceptionResponse === 'object' && 'message' in exceptionResponse
            ? (exceptionResponse as any).message
            : exception.message,
          details: typeof exceptionResponse === 'object' && 'details' in exceptionResponse
            ? (exceptionResponse as any).details
            : undefined,
          timestamp,
          path,
          statusCode: status,
        };
      }
    }

    // Handle Prisma errors
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const prismaError = this.handlePrismaError(exception);
      return {
        success: false,
        error: prismaError.error,
        message: prismaError.message,
        details: prismaError.details,
        timestamp,
        path,
        statusCode: prismaError.statusCode,
      };
    }

    // Handle Prisma validation errors
    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        success: false,
        error: 'Database Validation Error',
        message: 'Invalid data provided to database operation',
        details: {
          type: 'prisma_validation',
          raw: exception.message
        },
        timestamp,
        path,
        statusCode: HttpStatus.BAD_REQUEST,
      };
    }

    // Handle unknown errors
    const error = exception instanceof Error ? exception : new Error('Unknown error');
    return {
      success: false,
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : error.message,
      details: process.env.NODE_ENV === 'production'
        ? undefined
        : { stack: error.stack },
      timestamp,
      path,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    };
  }

  private formatZodErrors(issues: ZodIssue[]): ZodFieldError[] {
    return issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
      received: 'received' in issue ? issue.received : undefined,
    }));
  }

  private parseZodValidationPipeErrors(messages: string[]): ZodFieldError[] {
    // The ZodValidationPipe formats errors as strings like "field: message"
    return messages.map(message => {
      const [field, ...messageParts] = message.split(': ');
      return {
        field: field || 'unknown',
        message: messageParts.join(': ') || message,
        code: 'validation_error',
      };
    });
  }

  private handlePrismaError(error: Prisma.PrismaClientKnownRequestError) {
    // Handle only the most common cases for now
    switch (error.code) {
      case 'P2002': // Unique constraint
        return { statusCode: 409, error: 'Resource already exists', message: error.message, details: error.meta };
      case 'P2025': // Record not found
        return { statusCode: 404, error: 'Resource not found', message: error.message, details: error.meta };
      case 'P2003': // Foreign key constraint
        return { statusCode: 400, error: 'Invalid reference', message: error.message, details: error.meta };
      default:
        // Generic database error for everything else
        return { statusCode: 500, error: 'Database operation failed', message: error.message, details: error.meta };
    }
  }
}
