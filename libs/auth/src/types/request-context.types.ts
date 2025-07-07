export interface RequestContext {
  requestId: string;
  correlationId: string;
  timestamp: Date;
}

export interface RequestContextStore {
  getRequestContext(): RequestContext | undefined;
  setRequestContext(context: RequestContext): void;
  getRequestId(): string | undefined;
  getCorrelationId(): string | undefined;
}