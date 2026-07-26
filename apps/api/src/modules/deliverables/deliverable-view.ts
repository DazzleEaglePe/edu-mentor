import type { ScanStatus, SubmissionStatus } from '../../generated/prisma/enums.js';

export interface RubricCriterionView {
  readonly description: string;
  readonly id: string;
  readonly label: string;
  readonly maxScore: number;
}

export interface AssignmentView {
  readonly dueAt: string;
  readonly id: string;
  readonly instructions: string;
  readonly isActive: boolean;
  readonly maxScore: number;
  readonly oleada: {
    readonly id: string;
    readonly name: string;
  };
  readonly rubric: readonly RubricCriterionView[];
  readonly title: string;
  readonly version: number;
  readonly weekNumber: number;
}

export interface DeliverableFileView {
  readonly detectedMimeType: string;
  readonly id: string;
  readonly originalName: string;
  readonly scanStatus: ScanStatus;
  readonly sizeBytes: number;
}

export interface RubricScoreView {
  readonly comment?: string;
  readonly criterionId: string;
  readonly score: number;
}

export interface EvaluationView {
  readonly evaluatedAt: string;
  readonly feedback: string;
  readonly id: string;
  readonly mentor: {
    readonly fullName: string;
    readonly id: string;
  };
  readonly rubricScores: readonly RubricScoreView[];
  readonly score: number;
  readonly submissionId: string;
}

export interface SubmissionView {
  readonly evaluation: EvaluationView | null;
  readonly files: readonly DeliverableFileView[];
  readonly id: string;
  readonly notes: string;
  readonly previousSubmissionId: string | null;
  readonly revisionNumber: number;
  readonly status: SubmissionStatus;
  readonly submittedAt: string | null;
  readonly version: number;
}

export interface DeliverableDetailView {
  readonly assignment: AssignmentView;
  readonly currentSubmissionId: string | null;
  readonly enrollmentId: string;
  readonly id: string;
  readonly submissions: readonly SubmissionView[];
}

export interface DeliverablePage {
  readonly data: readonly DeliverableDetailView[];
  readonly meta: {
    readonly hasNextPage: boolean;
    readonly limit: number;
    readonly page: number;
    readonly total: number;
  };
}

export interface TopCandidateView {
  readonly rank: number;
  readonly submissionId: string;
}

export interface TopCandidatesView {
  readonly assignmentId: string;
  readonly candidates: readonly TopCandidateView[];
  readonly provisionalRule: boolean;
  readonly version: number;
}
