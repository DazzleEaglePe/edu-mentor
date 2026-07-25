import type { IncomingHttpHeaders } from 'node:http';

import type { TraceableRequest } from '../http/trace-id.js';
import type { AuthPrincipal } from './auth-principal.js';

export interface AuthenticatedRequest extends TraceableRequest {
  auth?: AuthPrincipal;
  readonly headers: IncomingHttpHeaders;
  readonly ip?: string;
  readonly socket?: {
    readonly remoteAddress?: string;
  };
}
