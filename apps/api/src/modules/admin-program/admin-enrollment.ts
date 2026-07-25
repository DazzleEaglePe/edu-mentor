import type { EnrollmentStatus, ProgramPhase } from '../../generated/prisma/enums.js';
import type { AdminUser } from '../admin-users/admin-user.js';

export interface AdminEnrollment {
  readonly currentPhase: ProgramPhase;
  readonly currentWeek: number | null;
  readonly enrolledAt: string;
  readonly id: string;
  readonly oleada: {
    readonly id: string;
    readonly name: string;
  };
  readonly phase1GraduatedAt: string | null;
  readonly status: EnrollmentStatus;
  readonly user: AdminUser;
  readonly version: number;
}

export interface AdminEnrollmentPage {
  readonly data: readonly AdminEnrollment[];
  readonly meta: {
    readonly hasNextPage: boolean;
    readonly limit: number;
    readonly page: number;
    readonly total: number;
  };
}

export interface CreateAdminEnrollmentInput {
  readonly actorUserId: string;
  readonly currentPhase: 'FASE_0' | 'FASE_1';
  readonly expiresAt: Date;
  readonly idempotencyKeyHash: string;
  readonly oleadaId: string;
  readonly organizationId: string;
  readonly requestHash: string;
  readonly traceId: string;
  readonly userId: string;
}

export type CreateAdminEnrollmentResult =
  | {
      readonly enrollment: AdminEnrollment;
      readonly kind: 'created' | 'replayed';
    }
  | {
      readonly kind: 'idempotency_key_reused';
    }
  | {
      readonly kind: 'invalid_target';
    }
  | {
      readonly kind: 'oleada_closed';
    }
  | {
      readonly kind: 'user_not_eligible';
    }
  | {
      readonly capacity: number;
      readonly kind: 'capacity_reached';
    }
  | {
      readonly kind: 'already_exists';
    };

export interface ListAdminEnrollmentFilters {
  readonly oleadaId?: string;
  readonly phase?: ProgramPhase;
  readonly status?: EnrollmentStatus;
}

export interface UpdateAdminEnrollmentInput {
  readonly actorUserId: string;
  readonly currentPhase?: ProgramPhase;
  readonly currentWeek?: number | null;
  readonly enrollmentId: string;
  readonly expectedVersion: number;
  readonly organizationId: string;
  readonly status?: EnrollmentStatus;
  readonly traceId: string;
}

export type UpdateAdminEnrollmentResult =
  | {
      readonly enrollment: AdminEnrollment;
      readonly kind: 'updated';
    }
  | {
      readonly kind: 'not_found';
    }
  | {
      readonly currentVersion: number;
      readonly kind: 'conflict';
    }
  | {
      readonly kind: 'terminal';
    }
  | {
      readonly currentStatus: EnrollmentStatus;
      readonly kind: 'invalid_status_transition';
      readonly requestedStatus: EnrollmentStatus;
    }
  | {
      readonly currentPhase: ProgramPhase;
      readonly kind: 'invalid_phase_transition';
      readonly requestedPhase: ProgramPhase;
    }
  | {
      readonly kind: 'phase_week_mismatch';
      readonly phase: ProgramPhase;
    };
