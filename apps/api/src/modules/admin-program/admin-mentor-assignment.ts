import type { MentorCapabilityKind } from '../../generated/prisma/enums.js';

export type AdminMentorAssignmentStatus = 'ACTIVE' | 'CLOSED';

export interface AdminMentorAssignment {
  readonly capability: MentorCapabilityKind;
  readonly endsAt: string | null;
  readonly enrollmentId: string | null;
  readonly id: string;
  readonly mentor: {
    readonly fullName: string;
    readonly id: string;
  };
  readonly oleada: {
    readonly id: string;
    readonly name: string;
  };
  readonly startsAt: string;
  readonly status: AdminMentorAssignmentStatus;
  readonly version: number;
}

export interface AdminMentorAssignmentPage {
  readonly data: readonly AdminMentorAssignment[];
  readonly meta: {
    readonly hasNextPage: boolean;
    readonly limit: number;
    readonly page: number;
    readonly total: number;
  };
}

export interface CreateAdminMentorAssignmentInput {
  readonly actorUserId: string;
  readonly capability: 'SPECIALIST';
  readonly endsAt: Date | null;
  readonly enrollmentId: string | null;
  readonly expiresAt: Date;
  readonly idempotencyKeyHash: string;
  readonly mentorUserId: string;
  readonly oleadaId: string;
  readonly organizationId: string;
  readonly requestHash: string;
  readonly startsAt: Date;
  readonly traceId: string;
}

export type CreateAdminMentorAssignmentResult =
  | {
      readonly assignment: AdminMentorAssignment;
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
      readonly kind: 'mentor_not_eligible';
    }
  | {
      readonly kind: 'active_scope_conflict';
    };

export interface ListAdminMentorAssignmentFilters {
  readonly active?: boolean;
  readonly mentorUserId?: string;
  readonly oleadaId?: string;
}

export interface CloseAdminMentorAssignmentInput {
  readonly actorUserId: string;
  readonly expectedVersion: number;
  readonly mentorAssignmentId: string;
  readonly organizationId: string;
  readonly traceId: string;
}

export type CloseAdminMentorAssignmentResult =
  | {
      readonly kind: 'closed';
    }
  | {
      readonly kind: 'not_found';
    }
  | {
      readonly currentVersion: number;
      readonly kind: 'conflict';
    }
  | {
      readonly kind: 'already_closed';
    }
  | {
      readonly kind: 'not_started';
    };
