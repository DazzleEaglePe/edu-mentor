import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

import { ApiError, type ApiErrorDetails } from './api-error.js';
import { getOrCreateTraceId, type TraceableRequest } from './trace-id.js';

interface ErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly traceId: string;
    readonly details?: ApiErrorDetails;
  };
}

interface HttpResponse {
  json(body: ErrorBody): void;
  status(statusCode: number): HttpResponse;
}

export interface PublicApiError {
  readonly code: string;
  readonly details?: ApiErrorDetails;
  readonly message: string;
  readonly statusCode: number;
}

const publicErrorsByStatus = new Map<number, Omit<PublicApiError, 'statusCode'>>([
  [
    HttpStatus.BAD_REQUEST,
    { code: 'BAD_REQUEST', message: 'La solicitud contiene datos inválidos.' },
  ],
  [HttpStatus.UNAUTHORIZED, { code: 'UNAUTHORIZED', message: 'Debes iniciar sesión.' }],
  [
    HttpStatus.FORBIDDEN,
    { code: 'FORBIDDEN', message: 'No tienes permiso para realizar esta acción.' },
  ],
  [HttpStatus.NOT_FOUND, { code: 'NOT_FOUND', message: 'No encontramos el recurso solicitado.' }],
  [
    HttpStatus.CONFLICT,
    { code: 'CONFLICT', message: 'La operación entra en conflicto con el estado actual.' },
  ],
  [
    HttpStatus.UNPROCESSABLE_ENTITY,
    { code: 'UNPROCESSABLE_ENTITY', message: 'No pudimos procesar los datos enviados.' },
  ],
  [
    HttpStatus.TOO_MANY_REQUESTS,
    { code: 'TOO_MANY_REQUESTS', message: 'Recibimos demasiadas solicitudes. Intenta más tarde.' },
  ],
]);

const internalServerError: PublicApiError = {
  code: 'INTERNAL_SERVER_ERROR',
  message: 'No pudimos completar la operación.',
  statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
};

export function toPublicApiError(exception: unknown): PublicApiError {
  if (exception instanceof ApiError) {
    return {
      code: exception.code,
      message: exception.safeMessage,
      statusCode: exception.getStatus(),
      ...(exception.details === undefined ? {} : { details: exception.details }),
    };
  }

  if (exception instanceof HttpException) {
    const statusCode = exception.getStatus();
    const publicError = publicErrorsByStatus.get(statusCode);

    if (publicError !== undefined) {
      return { ...publicError, statusCode };
    }
  }

  return internalServerError;
}

@Catch()
export class ErrorEnvelopeFilter implements ExceptionFilter {
  private readonly logger = new Logger(ErrorEnvelopeFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<TraceableRequest>();
    const response = http.getResponse<HttpResponse>();
    const traceId = getOrCreateTraceId(request);
    const publicError = toPublicApiError(exception);

    if (publicError.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        JSON.stringify({
          errorName: exception instanceof Error ? exception.name : 'UnknownError',
          event: 'unhandled_http_exception',
          method: request.method ?? 'UNKNOWN',
          path: request.url?.split('?')[0] ?? 'UNKNOWN',
          statusCode: publicError.statusCode,
          traceId,
        }),
      );
    }

    response.status(publicError.statusCode).json({
      error: {
        code: publicError.code,
        message: publicError.message,
        traceId,
        ...(publicError.details === undefined ? {} : { details: publicError.details }),
      },
    });
  }
}
