import type { SessionPhase, SessionType } from '../../generated/prisma/enums.js';
import type { SessionParticipantView, SessionView } from './session-view.js';

export interface CreateSessionInput {
  readonly actorIsAdmin: boolean;
  readonly actorUserId: string;
  readonly checkpointMonth: number | null;
  readonly description: string | null;
  readonly endsAt: Date;
  readonly enrollmentIds: readonly string[];
  readonly expiresAt: Date;
  readonly idempotencyKeyHash: string;
  readonly meetingUrl: string | null;
  readonly mentorUserId: string;
  readonly oleadaId: string;
  readonly organizationId: string;
  readonly phase: SessionPhase;
  readonly requestHash: string;
  readonly startsAt: Date;
  readonly timezone: string;
  readonly title: string;
  readonly traceId: string;
  readonly type: SessionType;
  readonly weekNumber: number | null;
}

export interface ScheduleConflict {
  readonly canViewConflictingSession: boolean;
  readonly conflictingSessionId: string | null;
  readonly occupiedInterval: {
    readonly endsAt: string;
    readonly startsAt: string;
    readonly timezone: string;
  };
  readonly resourceId: string;
  readonly resourceType: 'ENROLLMENT' | 'USER';
}

export type CreateSessionResult =
  | {
      readonly kind: 'created' | 'replayed';
      readonly session: SessionView;
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
      readonly kind: 'participant_count_invalid';
    }
  | {
      readonly kind: 'phase_mismatch';
    }
  | {
      readonly kind: 'mentor_not_eligible';
    }
  | {
      readonly kind: 'mentor_not_assigned';
    }
  | {
      readonly conflict: ScheduleConflict;
      readonly kind: 'schedule_conflict';
    };

export interface SetOwnConfirmationInput {
  readonly actorUserId: string;
  readonly expectedVersion: number;
  readonly organizationId: string;
  readonly sessionId: string;
  readonly status: 'CONFIRMED' | 'DECLINED';
  readonly traceId: string;
}

export type SetOwnConfirmationResult =
  | {
      readonly kind: 'updated' | 'unchanged';
      readonly participant: SessionParticipantView;
    }
  | {
      readonly kind: 'not_found';
    }
  | {
      readonly currentVersion: number;
      readonly kind: 'conflict';
    }
  | {
      readonly confirmationClosesAt: string;
      readonly kind: 'confirmation_closed';
    }
  | {
      readonly kind: 'session_not_scheduled';
    };

export interface SetParticipantAttendanceInput {
  readonly actorIsAdmin: boolean;
  readonly actorUserId: string;
  readonly enrollmentId: string;
  readonly expectedVersion: number;
  readonly organizationId: string;
  readonly sessionId: string;
  readonly status: 'ATTENDED' | 'ABSENT';
  readonly traceId: string;
}

export type SetParticipantAttendanceResult =
  | {
      readonly kind: 'updated' | 'unchanged';
      readonly participant: SessionParticipantView;
    }
  | {
      readonly kind: 'not_found';
    }
  | {
      readonly kind: 'forbidden';
    }
  | {
      readonly currentVersion: number;
      readonly kind: 'conflict';
    }
  | {
      readonly kind: 'session_not_started';
      readonly startsAt: string;
    }
  | {
      readonly kind: 'session_not_attendable';
    }
  | {
      readonly kind: 'attendance_already_recorded';
    };

export interface CompleteSessionInput {
  readonly actorIsAdmin: boolean;
  readonly actorUserId: string;
  readonly expectedVersion: number;
  readonly organizationId: string;
  readonly sessionId: string;
  readonly traceId: string;
}

export type CompleteSessionResult =
  | {
      readonly kind: 'updated';
      readonly session: SessionView;
    }
  | {
      readonly kind: 'not_found';
    }
  | {
      readonly kind: 'forbidden';
    }
  | {
      readonly currentVersion: number;
      readonly kind: 'conflict';
    }
  | {
      readonly kind: 'session_not_started';
      readonly startsAt: string;
    }
  | {
      readonly kind: 'session_not_scheduled';
    };

export interface CancelSessionInput {
  readonly actorIsAdmin: boolean;
  readonly actorUserId: string;
  readonly expectedVersion: number;
  readonly organizationId: string;
  readonly reason: string;
  readonly sessionId: string;
  readonly traceId: string;
}

export type CancelSessionResult =
  | {
      readonly kind: 'updated';
      readonly session: SessionView;
    }
  | {
      readonly kind: 'not_found';
    }
  | {
      readonly kind: 'forbidden';
    }
  | {
      readonly currentVersion: number;
      readonly kind: 'conflict';
    }
  | {
      readonly kind: 'session_not_scheduled';
    };

export interface RescheduleSessionInput {
  readonly actorIsAdmin: boolean;
  readonly actorUserId: string;
  readonly durationMinutes: number;
  readonly expectedVersion: number;
  readonly expiresAt: Date;
  readonly idempotencyKeyHash: string;
  readonly meetingUrl: string | null;
  readonly organizationId: string;
  readonly reason: string;
  readonly requestHash: string;
  readonly sessionId: string;
  readonly startsAt: Date;
  readonly traceId: string;
}

export type RescheduleSessionResult =
  | {
      readonly kind: 'created' | 'replayed';
      readonly replacementSession: SessionView;
    }
  | {
      readonly kind: 'idempotency_key_reused';
    }
  | {
      readonly kind: 'not_found';
    }
  | {
      readonly kind: 'forbidden';
    }
  | {
      readonly currentVersion: number;
      readonly kind: 'conflict';
    }
  | {
      readonly kind: 'session_not_scheduled';
    }
  | {
      readonly conflict: ScheduleConflict;
      readonly kind: 'schedule_conflict';
    };

export interface CreateRescheduleRequestInput {
  readonly actorUserId: string;
  readonly expiresAt: Date;
  readonly idempotencyKeyHash: string;
  readonly organizationId: string;
  readonly proposedStartsAt: Date | null;
  readonly reason: string;
  readonly requestHash: string;
  readonly sessionId: string;
  readonly traceId: string;
}

export type CreateRescheduleRequestResult =
  | {
      readonly kind: 'created' | 'replayed';
      readonly request: import('./session-view.js').RescheduleRequestView;
    }
  | {
      readonly kind: 'idempotency_key_reused';
    }
  | {
      readonly kind: 'not_found';
    }
  | {
      readonly kind: 'forbidden';
    }
  | {
      readonly kind: 'pending_request_exists';
    }
  | {
      readonly kind: 'session_not_scheduled';
    };

export interface ApproveRescheduleRequestInput {
  readonly actorIsAdmin: boolean;
  readonly actorUserId: string;
  readonly durationMinutes: number | null;
  readonly expectedRequestVersion: number;
  readonly expectedSessionVersion: number;
  readonly expiresAt: Date;
  readonly idempotencyKeyHash: string;
  readonly meetingUrl: string | null;
  readonly organizationId: string;
  readonly requestId: string;
  readonly requestHash: string;
  readonly startsAt: Date;
  readonly traceId: string;
}

export type ApproveRescheduleRequestResult =
  | {
      readonly kind: 'approved' | 'replayed';
      readonly replacementSession: SessionView;
      readonly request: import('./session-view.js').RescheduleRequestView;
    }
  | {
      readonly kind: 'idempotency_key_reused';
    }
  | {
      readonly kind: 'not_found';
    }
  | {
      readonly kind: 'forbidden';
    }
  | {
      readonly currentRequestVersion?: number;
      readonly currentSessionVersion?: number;
      readonly kind: 'conflict';
    }
  | {
      readonly kind: 'request_not_pending';
    }
  | {
      readonly kind: 'session_not_scheduled';
    }
  | {
      readonly conflict: ScheduleConflict;
      readonly kind: 'schedule_conflict';
    };

export interface RejectRescheduleRequestInput {
  readonly actorIsAdmin: boolean;
  readonly actorUserId: string;
  readonly organizationId: string;
  readonly reason: string;
  readonly requestId: string;
  readonly traceId: string;
}

export type RejectRescheduleRequestResult =
  | {
      readonly kind: 'updated';
      readonly request: import('./session-view.js').RescheduleRequestView;
    }
  | {
      readonly kind: 'not_found';
    }
  | {
      readonly kind: 'forbidden';
    }
  | {
      readonly kind: 'request_not_pending';
    };

export interface CancelOwnRescheduleRequestInput {
  readonly actorUserId: string;
  readonly expectedVersion: number;
  readonly organizationId: string;
  readonly requestId: string;
  readonly traceId: string;
}

export type CancelOwnRescheduleRequestResult =
  | {
      readonly kind: 'updated';
      readonly request: import('./session-view.js').RescheduleRequestView;
    }
  | {
      readonly kind: 'not_found';
    }
  | {
      readonly kind: 'forbidden';
    }
  | {
      readonly currentVersion: number;
      readonly kind: 'conflict';
    }
  | {
      readonly kind: 'request_not_pending';
    };

