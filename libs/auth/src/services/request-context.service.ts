import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import { RequestContext, RequestContextStore } from '../types/request-context.types';

@Injectable()
export class RequestContextService implements RequestContextStore {
  private static readonly asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

  static run<T>(context: RequestContext, callback: () => T): T {
    return RequestContextService.asyncLocalStorage.run(context, callback);
  }

  static createContext(correlationId?: string): RequestContext {
    return {
      requestId: randomUUID(),
      correlationId: correlationId || randomUUID(),
      timestamp: new Date(),
    };
  }

  getRequestContext(): RequestContext | undefined {
    return RequestContextService.asyncLocalStorage.getStore();
  }

  setRequestContext(context: RequestContext): void {
    throw new Error('Cannot set context directly. Use RequestContextService.run() instead.');
  }

  getRequestId(): string | undefined {
    return this.getRequestContext()?.requestId;
  }

  getCorrelationId(): string | undefined {
    return this.getRequestContext()?.correlationId;
  }

  getCurrentTimestamp(): Date | undefined {
    return this.getRequestContext()?.timestamp;
  }
}