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
