import { randomUUID } from 'node:crypto';

import type { Prisma } from '../../generated/prisma/client.js';

export interface IdempotencyReservationInput {
  readonly expiresAt: Date;
  readonly keyHash: string;
  readonly operation: string;
  readonly organizationId: string;
  readonly requestHash: string;
}

export type IdempotencyReservation =
  | {
      readonly kind: 'owner';
    }
  | {
      readonly kind: 'reused';
    }
  | {
      readonly kind: 'replay';
      readonly responseBody: Prisma.JsonValue;
      readonly responseStatus: number;
    };

export async function reserveIdempotency(
  transaction: Prisma.TransactionClient,
  input: IdempotencyReservationInput,
): Promise<IdempotencyReservation> {
  await transaction.idempotencyRecord.deleteMany({
    where: {
      expiresAt: {
        lte: new Date(),
      },
      keyHash: input.keyHash,
      operation: input.operation,
      organizationId: input.organizationId,
    },
  });

  const reservation = await transaction.idempotencyRecord.createMany({
    data: {
      expiresAt: input.expiresAt,
      id: randomUUID(),
      keyHash: input.keyHash,
      operation: input.operation,
      organizationId: input.organizationId,
      requestHash: input.requestHash,
    },
    skipDuplicates: true,
  });

  if (reservation.count === 1) {
    return { kind: 'owner' };
  }

  const stored = await transaction.idempotencyRecord.findUnique({
    where: {
      organizationId_operation_keyHash: {
        keyHash: input.keyHash,
        operation: input.operation,
        organizationId: input.organizationId,
      },
    },
  });

  if (stored === null) {
    throw new Error('The idempotency reservation disappeared unexpectedly.');
  }

  if (stored.requestHash !== input.requestHash) {
    return { kind: 'reused' };
  }

  if (stored.responseStatus === null || stored.responseBody === null) {
    throw new Error('The stored idempotency response is incomplete.');
  }

  return {
    kind: 'replay',
    responseBody: stored.responseBody,
    responseStatus: stored.responseStatus,
  };
}

export interface CompleteIdempotencyInput {
  readonly keyHash: string;
  readonly operation: string;
  readonly organizationId: string;
  readonly resourceId: string;
  readonly responseBody: Prisma.InputJsonObject;
  readonly responseStatus: number;
}

export async function completeIdempotency(
  transaction: Prisma.TransactionClient,
  input: CompleteIdempotencyInput,
): Promise<void> {
  await transaction.idempotencyRecord.update({
    data: {
      resourceId: input.resourceId,
      responseBody: input.responseBody,
      responseStatus: input.responseStatus,
    },
    where: {
      organizationId_operation_keyHash: {
        keyHash: input.keyHash,
        operation: input.operation,
        organizationId: input.organizationId,
      },
    },
  });
}
