import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { NotFoundException } from '@nestjs/common';

import { ApiError } from './api-error.js';
import { toPublicApiError } from './error-envelope.filter.js';
import {
  getOrCreateTraceId,
  TRACE_ID,
  TRACE_ID_HEADER,
  traceIdMiddleware,
  type TraceableRequest,
} from './trace-id.js';

describe('HTTP boundary', () => {
  it('generates one trace ID and exposes the same value in the response header', () => {
    const request: TraceableRequest = {};
    const headers = new Map<string, string>();
    let nextWasCalled = false;

    traceIdMiddleware(
      request,
      {
        setHeader(name, value) {
          headers.set(name, value);
        },
      },
      () => {
        nextWasCalled = true;
      },
    );

    assert.equal(nextWasCalled, true);
    assert.match(request[TRACE_ID] ?? '', /^[0-9a-f-]{36}$/u);
    assert.equal(headers.get(TRACE_ID_HEADER), request[TRACE_ID]);
    assert.equal(getOrCreateTraceId(request), request[TRACE_ID]);
  });

  it('preserves stable application error codes and sanitized details', () => {
    const details = { expectedVersion: 3 };

    assert.deepEqual(
      toPublicApiError(
        new ApiError(
          409,
          'VERSION_CONFLICT',
          'El recurso cambió. Actualiza e inténtalo otra vez.',
          details,
        ),
      ),
      {
        code: 'VERSION_CONFLICT',
        details,
        message: 'El recurso cambió. Actualiza e inténtalo otra vez.',
        statusCode: 409,
      },
    );
  });

  it('does not expose framework or unknown exception messages', () => {
    assert.deepEqual(toPublicApiError(new NotFoundException('private-resource-name')), {
      code: 'NOT_FOUND',
      message: 'No encontramos el recurso solicitado.',
      statusCode: 404,
    });

    assert.deepEqual(toPublicApiError(new Error('database credentials leaked here')), {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'No pudimos completar la operación.',
      statusCode: 500,
    });
  });
});
