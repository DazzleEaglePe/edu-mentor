import { randomUUID } from 'node:crypto';

export const TRACE_ID = Symbol('TRACE_ID');
export const TRACE_ID_HEADER = 'X-Trace-Id';

export interface TraceableRequest {
  [TRACE_ID]?: string;
  readonly method?: string;
  readonly url?: string;
}

interface HeaderResponse {
  setHeader(name: string, value: string): void;
}

export function createTraceId(): string {
  return randomUUID();
}

export function getOrCreateTraceId(request: TraceableRequest): string {
  request[TRACE_ID] ??= createTraceId();
  return request[TRACE_ID];
}

export function traceIdMiddleware(
  request: TraceableRequest,
  response: HeaderResponse,
  next: () => void,
): void {
  response.setHeader(TRACE_ID_HEADER, getOrCreateTraceId(request));
  next();
}
