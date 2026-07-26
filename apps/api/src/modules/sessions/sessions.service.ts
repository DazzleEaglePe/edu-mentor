import { Inject, Injectable } from '@nestjs/common';

import type { AuthPrincipal } from '../../common/auth/auth-principal.js';
import { ApiError } from '../../common/http/api-error.js';
import type {
  SessionListFilters,
  SessionPage,
  SessionSummaryView,
  SessionView,
} from './session-view.js';
import { SessionsRepository } from './sessions.repository.js';

const ISO_TIMESTAMP_WITH_OFFSET = /(?:Z|[+-]\d{2}:\d{2})$/u;

export interface SessionListCommand {
  readonly from?: string;
  readonly limit: number;
  readonly oleadaId?: string;
  readonly page: number;
  readonly phase?: 'FASE_1' | 'FASE_2';
  readonly status?: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';
  readonly to?: string;
}

function parseTimestamp(field: 'from' | 'to', value: string): Date {
  const parsed = new Date(value);

  if (!ISO_TIMESTAMP_WITH_OFFSET.test(value) || Number.isNaN(parsed.getTime())) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'No pudimos procesar los datos enviados.', {
      fields: [field],
    });
  }

  return parsed;
}

function parseRange(
  fromValue: string | undefined,
  toValue: string | undefined,
): {
  readonly from?: Date;
  readonly to?: Date;
} {
  const from = fromValue === undefined ? undefined : parseTimestamp('from', fromValue);
  const to = toValue === undefined ? undefined : parseTimestamp('to', toValue);

  if (from !== undefined && to !== undefined && from.getTime() >= to.getTime()) {
    throw new ApiError(
      422,
      'INVALID_TIME_RANGE',
      'El inicio del rango debe ser anterior al final.',
    );
  }

  return {
    ...(from === undefined ? {} : { from }),
    ...(to === undefined ? {} : { to }),
  };
}

@Injectable()
export class SessionsService {
  constructor(@Inject(SessionsRepository) private readonly repository: SessionsRepository) {}

  async list(principal: AuthPrincipal, command: SessionListCommand): Promise<SessionPage> {
    const range = parseRange(command.from, command.to);
    const filters: SessionListFilters = {
      ...range,
      ...(command.oleadaId === undefined ? {} : { oleadaId: command.oleadaId }),
      ...(command.phase === undefined ? {} : { phase: command.phase }),
      ...(command.status === undefined ? {} : { status: command.status }),
    };

    return this.repository.list(principal, command.page, command.limit, filters);
  }

  async calendar(
    principal: AuthPrincipal,
    fromValue: string,
    toValue: string,
  ): Promise<readonly SessionSummaryView[]> {
    const { from, to } = parseRange(fromValue, toValue);

    if (from === undefined || to === undefined) {
      throw new Error('Calendar range unexpectedly omitted a required boundary.');
    }

    return this.repository.calendar(principal, from, to);
  }

  async get(principal: AuthPrincipal, sessionId: string): Promise<SessionView> {
    const session = await this.repository.findById(principal, sessionId);

    if (session === null) {
      throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'No encontramos el recurso solicitado.');
    }

    return session;
  }
}
