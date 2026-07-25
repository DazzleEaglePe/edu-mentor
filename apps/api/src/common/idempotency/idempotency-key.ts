import { ApiError } from '../http/api-error.js';

const IDEMPOTENCY_KEY_MIN_LENGTH = 16;
const IDEMPOTENCY_KEY_MAX_LENGTH = 128;

export const IDEMPOTENCY_RETENTION_MS = 24 * 60 * 60 * 1_000;

export function requireIdempotencyKey(value: string | undefined): string {
  const normalized = value?.trim();

  if (
    normalized === undefined ||
    normalized.length < IDEMPOTENCY_KEY_MIN_LENGTH ||
    normalized.length > IDEMPOTENCY_KEY_MAX_LENGTH
  ) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'No pudimos procesar los datos enviados.', {
      fields: ['Idempotency-Key'],
    });
  }

  return normalized;
}
