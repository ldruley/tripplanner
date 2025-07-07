import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RequestContextService } from '../services/request-context.service';

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Extract correlation ID from request headers, or generate new one
    const correlationId = request.headers['x-correlation-id'] as string | undefined;
    
    // Create request context
    const requestContext = RequestContextService.createContext(correlationId);

    // Set response headers
    response.setHeader('x-request-id', requestContext.requestId);
    response.setHeader('x-correlation-id', requestContext.correlationId);

    // Run the request handler within the context
    return RequestContextService.run(requestContext, () => {
      return next.handle();
    });
  }
}