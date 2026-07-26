import type {
  AttendanceStatus,
  ConfirmationStatus,
  SessionPhase,
  SessionStatus,
  SessionType,
} from '../../generated/prisma/enums.js';

export interface ConfirmationSummary {
  readonly confirmed: number;
  readonly declined: number;
  readonly pending: number;
  readonly total: number;
}

export interface SessionSummaryView {
  readonly canConfirm: boolean;
  readonly confirmationClosesAt: string;
  readonly confirmationSummary: ConfirmationSummary;
  readonly endsAt: string;
  readonly id: string;
  readonly phase: SessionPhase;
  readonly startsAt: string;
  readonly status: SessionStatus;
  readonly timezone: string;
  readonly title: string;
  readonly type: SessionType;
}

export interface SessionParticipantView {
  readonly attendanceStatus: AttendanceStatus;
  readonly confirmationStatus: ConfirmationStatus;
  readonly confirmedAt: string | null;
  readonly enrollmentId: string;
  readonly participant: {
    readonly fullName: string;
    readonly id: string;
  };
  readonly version: number;
}

export interface SessionView extends SessionSummaryView {
  readonly checkpointMonth: number | null;
  readonly description: string | null;
  readonly meetingUrl: string | null;
  readonly mentor: {
    readonly fullName: string;
    readonly id: string;
  };
  readonly oleada: {
    readonly id: string;
    readonly name: string;
  };
  readonly participants: readonly SessionParticipantView[];
  readonly rescheduledFromId: string | null;
  readonly version: number;
  readonly weekNumber: number | null;
}

export interface SessionPage {
  readonly data: readonly SessionView[];
  readonly meta: {
    readonly hasNextPage: boolean;
    readonly limit: number;
    readonly page: number;
    readonly total: number;
  };
}

export interface SessionListFilters {
  readonly from?: Date;
  readonly oleadaId?: string;
  readonly phase?: SessionPhase;
  readonly status?: SessionStatus;
  readonly to?: Date;
}
