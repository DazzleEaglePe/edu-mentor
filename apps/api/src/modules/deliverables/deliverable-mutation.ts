import type { DeliverableDetailView, DeliverableFileView, EvaluationView, SubmissionView, TopCandidatesView } from './deliverable-view.js';

export interface CreateDeliverableInput {
  readonly actorUserId: string;
  readonly assignmentId: string;
  readonly expiresAt: Date;
  readonly idempotencyKeyHash: string;
  readonly notes: string;
  readonly organizationId: string;
  readonly requestHash: string;
  readonly traceId: string;
}

export type CreateDeliverableResult =
  | {
      readonly deliverable: DeliverableDetailView;
      readonly kind: 'created' | 'replayed';
    }
  | {
      readonly kind: 'idempotency_key_reused';
    }
  | {
      readonly kind: 'assignment_not_found';
    }
  | {
      readonly kind: 'enrollment_not_found';
    }
  | {
      readonly kind: 'deliverable_already_exists';
    };

export interface SubmitSubmissionInput {
  readonly actorUserId: string;
  readonly deliverableId: string;
  readonly expectedVersion: number;
  readonly organizationId: string;
  readonly submissionId: string;
  readonly traceId: string;
}

export type SubmitSubmissionResult =
  | {
      readonly kind: 'submitted';
      readonly submission: SubmissionView;
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
      readonly kind: 'submission_not_draft';
    }
  | {
      readonly kind: 'files_not_clean';
    };

export interface StartReviewInput {
  readonly actorIsAdmin: boolean;
  readonly actorUserId: string;
  readonly deliverableId: string;
  readonly expectedVersion: number;
  readonly organizationId: string;
  readonly submissionId: string;
  readonly traceId: string;
}

export type StartReviewResult =
  | {
      readonly kind: 'started';
      readonly submission: SubmissionView;
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
      readonly kind: 'submission_not_submitted';
    };

export interface EvaluateSubmissionInput {
  readonly actorIsAdmin: boolean;
  readonly actorUserId: string;
  readonly deliverableId: string;
  readonly expectedVersion: number;
  readonly feedback: string;
  readonly organizationId: string;
  readonly rubricScores: readonly {
    readonly comment?: string;
    readonly criterionId: string;
    readonly score: number;
  }[];
  readonly score: number;
  readonly submissionId: string;
  readonly traceId: string;
}

export type EvaluateSubmissionResult =
  | {
      readonly evaluation: EvaluationView;
      readonly kind: 'evaluated';
      readonly submission: SubmissionView;
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
      readonly kind: 'submission_not_under_review';
    }
  | {
      readonly invalidCriterionId: string;
      readonly kind: 'rubric_criterion_invalid';
    }
  | {
      readonly criterionId: string;
      readonly kind: 'score_exceeds_max';
      readonly maxScore: number;
    };

export interface ReturnSubmissionInput {
  readonly actorIsAdmin: boolean;
  readonly actorUserId: string;
  readonly deliverableId: string;
  readonly expectedVersion: number;
  readonly organizationId: string;
  readonly reason: string;
  readonly submissionId: string;
  readonly traceId: string;
}

export type ReturnSubmissionResult =
  | {
      readonly kind: 'returned';
      readonly nextSubmission: SubmissionView;
      readonly returnedSubmission: SubmissionView;
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
      readonly kind: 'submission_not_under_review';
    };

export interface SetTopCandidatesInput {
  readonly actorIsAdmin: boolean;
  readonly actorUserId: string;
  readonly assignmentId: string;
  readonly candidates: readonly {
    readonly rank: number;
    readonly submissionId: string;
  }[];
  readonly expectedVersion: number;
  readonly organizationId: string;
  readonly traceId: string;
}

export type SetTopCandidatesResult =
  | {
      readonly kind: 'updated';
      readonly topCandidates: TopCandidatesView;
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
      readonly kind: 'invalid_rank';
    }
  | {
      readonly kind: 'submission_not_evaluated';
      readonly submissionId: string;
    };
