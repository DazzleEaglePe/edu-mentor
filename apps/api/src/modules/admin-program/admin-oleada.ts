import type { OleadaStatus } from '../../generated/prisma/enums.js';

export interface AdminOleada {
  readonly activeEnrollmentCount: number;
  readonly capacity: number;
  readonly endDate: string;
  readonly id: string;
  readonly name: string;
  readonly sector: string;
  readonly startDate: string;
  readonly status: OleadaStatus;
  readonly version: number;
}

export interface AdminOleadaPage {
  readonly data: readonly AdminOleada[];
  readonly meta: {
    readonly hasNextPage: boolean;
    readonly limit: number;
    readonly page: number;
    readonly total: number;
  };
}

export interface CreateAdminOleadaInput {
  readonly actorUserId: string;
  readonly capacity: number;
  readonly endDate: Date;
  readonly expiresAt: Date;
  readonly idempotencyKeyHash: string;
  readonly name: string;
  readonly organizationId: string;
  readonly requestHash: string;
  readonly sector: string;
  readonly startDate: Date;
  readonly traceId: string;
}

export type CreateAdminOleadaResult =
  | {
      readonly kind: 'created' | 'replayed';
      readonly oleada: AdminOleada;
    }
  | {
      readonly kind: 'idempotency_key_reused';
    };

export interface UpdateAdminOleadaInput {
  readonly actorUserId: string;
  readonly capacity?: number;
  readonly endDate?: Date;
  readonly expectedVersion: number;
  readonly name?: string;
  readonly oleadaId: string;
  readonly organizationId: string;
  readonly sector?: string;
  readonly startDate?: Date;
  readonly status?: OleadaStatus;
  readonly traceId: string;
}

export type UpdateAdminOleadaResult =
  | {
      readonly kind: 'updated';
      readonly oleada: AdminOleada;
    }
  | {
      readonly kind: 'not_found';
    }
  | {
      readonly currentVersion: number;
      readonly kind: 'conflict';
    }
  | {
      readonly activeEnrollmentCount: number;
      readonly kind: 'capacity_below_active';
    }
  | {
      readonly currentStatus: OleadaStatus;
      readonly kind: 'invalid_transition';
      readonly requestedStatus: OleadaStatus;
    }
  | {
      readonly kind: 'closed';
    }
  | {
      readonly kind: 'invalid_date_range';
    };
