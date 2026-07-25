import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';

import {
  completeIdempotency,
  reserveIdempotency,
} from '../../common/idempotency/idempotency-transaction.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { OleadaStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import {
  type AdminOleada,
  type AdminOleadaPage,
  type CreateAdminOleadaInput,
  type CreateAdminOleadaResult,
  type UpdateAdminOleadaInput,
  type UpdateAdminOleadaResult,
} from './admin-oleada.js';

const CREATE_ADMIN_OLEADA_OPERATION = 'admin.oleadas.create';

const adminOleadaInclude = {
  _count: {
    select: {
      enrollments: {
        where: {
          status: 'ACTIVE',
        },
      },
    },
  },
} as const satisfies Prisma.OleadaInclude;

type OleadaWithActiveCount = Prisma.OleadaGetPayload<{
  include: typeof adminOleadaInclude;
}>;

const nextStatus: Readonly<Record<OleadaStatus, OleadaStatus | null>> = {
  CLOSED: null,
  DRAFT: 'OPEN',
  IN_PROGRESS: 'CLOSED',
  OPEN: 'IN_PROGRESS',
};

function calendarDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function toAdminOleada(oleada: OleadaWithActiveCount): AdminOleada {
  return {
    activeEnrollmentCount: oleada._count.enrollments,
    capacity: oleada.capacity,
    endDate: calendarDate(oleada.endDate),
    id: oleada.id,
    name: oleada.name,
    sector: oleada.sector,
    startDate: calendarDate(oleada.startDate),
    status: oleada.status,
    version: oleada.version,
  };
}

function oleadaJson(oleada: AdminOleada): Prisma.InputJsonObject {
  return {
    activeEnrollmentCount: oleada.activeEnrollmentCount,
    capacity: oleada.capacity,
    endDate: oleada.endDate,
    id: oleada.id,
    name: oleada.name,
    sector: oleada.sector,
    startDate: oleada.startDate,
    status: oleada.status,
    version: oleada.version,
  };
}

function parseStoredOleada(value: Prisma.JsonValue): AdminOleada | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const { activeEnrollmentCount, capacity, endDate, id, name, sector, startDate, status, version } =
    value;

  if (
    typeof activeEnrollmentCount !== 'number' ||
    typeof capacity !== 'number' ||
    typeof endDate !== 'string' ||
    typeof id !== 'string' ||
    typeof name !== 'string' ||
    typeof sector !== 'string' ||
    typeof startDate !== 'string' ||
    (status !== 'DRAFT' && status !== 'OPEN' && status !== 'IN_PROGRESS' && status !== 'CLOSED') ||
    typeof version !== 'number'
  ) {
    return null;
  }

  return {
    activeEnrollmentCount,
    capacity,
    endDate,
    id,
    name,
    sector,
    startDate,
    status,
    version,
  };
}

function auditSnapshot(oleada: AdminOleada): Prisma.InputJsonObject {
  return {
    activeEnrollmentCount: oleada.activeEnrollmentCount,
    capacity: oleada.capacity,
    endDate: oleada.endDate,
    name: oleada.name,
    sector: oleada.sector,
    startDate: oleada.startDate,
    status: oleada.status,
    version: oleada.version,
  };
}

@Injectable()
export class AdminOleadasRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(
    organizationId: string,
    page: number,
    limit: number,
    status?: OleadaStatus,
  ): Promise<AdminOleadaPage> {
    const skip = (page - 1) * limit;
    const where: Prisma.OleadaWhereInput = {
      organizationId,
      ...(status === undefined ? {} : { status }),
    };
    const [oleadas, total] = await this.prisma.$transaction([
      this.prisma.oleada.findMany({
        include: adminOleadaInclude,
        orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
        skip,
        take: limit,
        where,
      }),
      this.prisma.oleada.count({ where }),
    ]);

    return {
      data: oleadas.map(toAdminOleada),
      meta: {
        hasNextPage: skip + oleadas.length < total,
        limit,
        page,
        total,
      },
    };
  }

  create(input: CreateAdminOleadaInput): Promise<CreateAdminOleadaResult> {
    return this.prisma.$transaction(async (transaction) => {
      const reservation = await reserveIdempotency(transaction, {
        expiresAt: input.expiresAt,
        keyHash: input.idempotencyKeyHash,
        operation: CREATE_ADMIN_OLEADA_OPERATION,
        organizationId: input.organizationId,
        requestHash: input.requestHash,
      });

      if (reservation.kind === 'reused') {
        return { kind: 'idempotency_key_reused' };
      }

      if (reservation.kind === 'replay') {
        const oleada = parseStoredOleada(reservation.responseBody);

        if (reservation.responseStatus !== 201 || oleada === null) {
          throw new Error('The stored oleada response is incomplete or invalid.');
        }

        return {
          kind: 'replayed',
          oleada,
        };
      }

      const stored = await transaction.oleada.create({
        data: {
          capacity: input.capacity,
          endDate: input.endDate,
          id: randomUUID(),
          name: input.name,
          organizationId: input.organizationId,
          sector: input.sector,
          startDate: input.startDate,
          status: 'DRAFT',
          version: 1,
        },
        include: adminOleadaInclude,
      });
      const oleada = toAdminOleada(stored);
      await transaction.auditLog.create({
        data: {
          action: 'admin.oleada_created',
          actorUserId: input.actorUserId,
          afterData: auditSnapshot(oleada),
          entityId: oleada.id,
          entityType: 'OLEADA',
          organizationId: input.organizationId,
          traceId: input.traceId,
        },
      });
      await completeIdempotency(transaction, {
        keyHash: input.idempotencyKeyHash,
        operation: CREATE_ADMIN_OLEADA_OPERATION,
        organizationId: input.organizationId,
        resourceId: oleada.id,
        responseBody: oleadaJson(oleada),
        responseStatus: 201,
      });

      return {
        kind: 'created',
        oleada,
      };
    });
  }

  update(input: UpdateAdminOleadaInput): Promise<UpdateAdminOleadaResult> {
    return this.prisma.$transaction(async (transaction) => {
      const locked = await transaction.$queryRaw<readonly { id: string }[]>`
        SELECT "id"
        FROM "oleada"
        WHERE "id" = ${input.oleadaId}::uuid
          AND "organization_id" = ${input.organizationId}::uuid
        FOR UPDATE
      `;

      if (locked.length === 0) {
        return { kind: 'not_found' };
      }

      const currentRecord = await transaction.oleada.findUnique({
        include: adminOleadaInclude,
        where: {
          id: input.oleadaId,
        },
      });

      if (currentRecord === null) {
        return { kind: 'not_found' };
      }

      const current = toAdminOleada(currentRecord);

      if (current.version !== input.expectedVersion) {
        return {
          currentVersion: current.version,
          kind: 'conflict',
        };
      }

      if (current.status === 'CLOSED') {
        return { kind: 'closed' };
      }

      if (
        input.status !== undefined &&
        input.status !== current.status &&
        nextStatus[current.status] !== input.status
      ) {
        return {
          currentStatus: current.status,
          kind: 'invalid_transition',
          requestedStatus: input.status,
        };
      }

      const capacity = input.capacity ?? current.capacity;

      if (capacity < current.activeEnrollmentCount) {
        return {
          activeEnrollmentCount: current.activeEnrollmentCount,
          kind: 'capacity_below_active',
        };
      }

      const startDate = input.startDate ?? currentRecord.startDate;
      const endDate = input.endDate ?? currentRecord.endDate;

      if (endDate.getTime() < startDate.getTime()) {
        return { kind: 'invalid_date_range' };
      }

      const updatedRecord = await transaction.oleada.update({
        data: {
          capacity,
          endDate,
          name: input.name ?? current.name,
          sector: input.sector ?? current.sector,
          startDate,
          status: input.status ?? current.status,
          version: {
            increment: 1,
          },
        },
        include: adminOleadaInclude,
        where: {
          id: input.oleadaId,
        },
      });
      const oleada = toAdminOleada(updatedRecord);
      await transaction.auditLog.create({
        data: {
          action: 'admin.oleada_updated',
          actorUserId: input.actorUserId,
          afterData: auditSnapshot(oleada),
          beforeData: auditSnapshot(current),
          entityId: oleada.id,
          entityType: 'OLEADA',
          organizationId: input.organizationId,
          traceId: input.traceId,
        },
      });

      return {
        kind: 'updated',
        oleada,
      };
    });
  }
}
