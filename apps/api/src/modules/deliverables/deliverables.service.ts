import { Inject, Injectable } from '@nestjs/common';

import type { AuthPrincipal } from '../../common/auth/auth-principal.js';
import { ApiError } from '../../common/http/api-error.js';
import { IdempotencyFingerprintService } from '../../common/idempotency/idempotency-fingerprint.service.js';
import { IDEMPOTENCY_RETENTION_MS, requireIdempotencyKey } from '../../common/idempotency/idempotency-key.js';
import { DeliverableMutationsRepository } from './deliverable-mutations.repository.js';
import type { DeliverableDetailView, DeliverablePage, SubmissionView, TopCandidatesView } from './deliverable-view.js';
import { DeliverablesRepository } from './deliverables.repository.js';

export interface DeliverableListCommand {
  readonly limit: number;
  readonly page: number;
  readonly status?: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'EVALUATED' | 'RETURNED';
}

export interface CreateDeliverableCommand {
  readonly assignmentId: string;
  readonly idempotencyKey: string | undefined;
  readonly notes: string;
  readonly traceId: string;
}

export interface SubmitSubmissionCommand {
  readonly deliverableId: string;
  readonly expectedVersion: number;
  readonly submissionId: string;
  readonly traceId: string;
}

export interface StartReviewCommand {
  readonly deliverableId: string;
  readonly expectedVersion: number;
  readonly submissionId: string;
  readonly traceId: string;
}

export interface EvaluateSubmissionCommand {
  readonly deliverableId: string;
  readonly expectedVersion: number;
  readonly feedback: string;
  readonly rubricScores: readonly {
    readonly comment?: string;
    readonly criterionId: string;
    readonly score: number;
  }[];
  readonly score: number;
  readonly submissionId: string;
  readonly traceId: string;
}

export interface ReturnSubmissionCommand {
  readonly deliverableId: string;
  readonly expectedVersion: number;
  readonly reason: string;
  readonly submissionId: string;
  readonly traceId: string;
}

export interface SetTopCandidatesCommand {
  readonly assignmentId: string;
  readonly candidates: readonly {
    readonly rank: number;
    readonly submissionId: string;
  }[];
  readonly expectedVersion: number;
  readonly traceId: string;
}

@Injectable()
export class DeliverablesService {
  constructor(
    @Inject(DeliverablesRepository) private readonly repository: DeliverablesRepository,
    @Inject(DeliverableMutationsRepository) private readonly mutations: DeliverableMutationsRepository,
    @Inject(IdempotencyFingerprintService) private readonly fingerprints: IdempotencyFingerprintService,
  ) {}

  async list(principal: AuthPrincipal, command: DeliverableListCommand): Promise<DeliverablePage> {
    return this.repository.list(principal, command.page, command.limit, command.status);
  }

  async listPendingReviews(
    principal: AuthPrincipal,
    page: number,
    limit: number,
  ): Promise<DeliverablePage> {
    return this.repository.listPendingReviews(principal, page, limit);
  }

  async get(principal: AuthPrincipal, deliverableId: string): Promise<DeliverableDetailView> {
    const deliverable = await this.repository.findById(principal, deliverableId);
    if (deliverable === null) {
      throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'No encontramos el recurso solicitado.');
    }
    return deliverable;
  }

  async create(principal: AuthPrincipal, command: CreateDeliverableCommand): Promise<DeliverableDetailView> {
    const idempotencyKey = requireIdempotencyKey(command.idempotencyKey);
    const notes = command.notes.trim();

    if (notes.length === 0 || notes.length > 2_000) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'No pudimos procesar los datos enviados.', {
        fields: ['notes'],
      });
    }

    const canonicalRequest = {
      assignmentId: command.assignmentId,
      notes,
    };

    const result = await this.mutations.create({
      actorUserId: principal.userId,
      assignmentId: command.assignmentId,
      expiresAt: new Date(Date.now() + IDEMPOTENCY_RETENTION_MS),
      idempotencyKeyHash: this.fingerprints.hashIdempotencyKey(idempotencyKey),
      notes,
      organizationId: principal.organization.id,
      requestHash: this.fingerprints.hashRequest('deliverables.create', canonicalRequest),
      traceId: command.traceId,
    });

    switch (result.kind) {
      case 'created':
      case 'replayed':
        return result.deliverable;
      case 'idempotency_key_reused':
        throw new ApiError(
          409,
          'IDEMPOTENCY_KEY_REUSED',
          'La clave de idempotencia ya se usó con otros datos.',
        );
      case 'assignment_not_found':
        throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'No encontramos el recurso solicitado.');
      case 'enrollment_not_found':
        throw new ApiError(403, 'FORBIDDEN', 'No tienes una matrícula activa para esta consigna.');
      case 'deliverable_already_exists':
        throw new ApiError(409, 'DELIVERABLE_ALREADY_EXISTS', 'Ya tienes un entregable iniciado para esta consigna.');
    }
  }

  async submit(principal: AuthPrincipal, command: SubmitSubmissionCommand): Promise<SubmissionView> {
    const result = await this.mutations.submit({
      actorUserId: principal.userId,
      deliverableId: command.deliverableId,
      expectedVersion: command.expectedVersion,
      organizationId: principal.organization.id,
      submissionId: command.submissionId,
      traceId: command.traceId,
    });

    switch (result.kind) {
      case 'submitted':
        return result.submission;
      case 'not_found':
        throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'No encontramos el recurso solicitado.');
      case 'forbidden':
        throw new ApiError(403, 'FORBIDDEN', 'No tienes permiso para realizar esta acción.');
      case 'conflict':
        throw new ApiError(
          409,
          'VERSION_CONFLICT',
          'El recurso cambió. Actualiza e inténtalo otra vez.',
          {
            currentVersion: result.currentVersion,
            expectedVersion: command.expectedVersion,
          },
        );
      case 'submission_not_draft':
        throw new ApiError(409, 'SUBMISSION_NOT_DRAFT', 'La entrega no está en borrador.');
      case 'files_not_clean':
        throw new ApiError(422, 'FILES_NOT_CLEAN', 'Todos los archivos deben haber pasado el escaneo de virus.');
    }
  }

  async startReview(principal: AuthPrincipal, command: StartReviewCommand): Promise<SubmissionView> {
    const result = await this.mutations.startReview({
      actorIsAdmin: principal.roles.includes('ADMIN'),
      actorUserId: principal.userId,
      deliverableId: command.deliverableId,
      expectedVersion: command.expectedVersion,
      organizationId: principal.organization.id,
      submissionId: command.submissionId,
      traceId: command.traceId,
    });

    switch (result.kind) {
      case 'started':
        return result.submission;
      case 'not_found':
        throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'No encontramos el recurso solicitado.');
      case 'forbidden':
        throw new ApiError(403, 'FORBIDDEN', 'No tienes permiso para realizar esta acción.');
      case 'conflict':
        throw new ApiError(
          409,
          'VERSION_CONFLICT',
          'El recurso cambió. Actualiza e inténtalo otra vez.',
        );
      case 'submission_not_submitted':
        throw new ApiError(409, 'SUBMISSION_NOT_SUBMITTED', 'La entrega debe estar en estado SUBMITTED.');
    }
  }

  async evaluate(principal: AuthPrincipal, command: EvaluateSubmissionCommand): Promise<SubmissionView> {
    const feedback = command.feedback.trim();
    if (feedback.length < 10 || feedback.length > 4_000) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'No pudimos procesar los datos enviados.', {
        fields: ['feedback'],
      });
    }

    const result = await this.mutations.evaluate({
      actorIsAdmin: principal.roles.includes('ADMIN'),
      actorUserId: principal.userId,
      deliverableId: command.deliverableId,
      expectedVersion: command.expectedVersion,
      feedback,
      organizationId: principal.organization.id,
      rubricScores: command.rubricScores,
      score: command.score,
      submissionId: command.submissionId,
      traceId: command.traceId,
    });

    switch (result.kind) {
      case 'evaluated':
        return result.submission;
      case 'not_found':
        throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'No encontramos el recurso solicitado.');
      case 'forbidden':
        throw new ApiError(403, 'FORBIDDEN', 'No tienes permiso para realizar esta acción.');
      case 'conflict':
        throw new ApiError(
          409,
          'VERSION_CONFLICT',
          'El recurso cambió. Actualiza e inténtalo otra vez.',
        );
      case 'submission_not_under_review':
        throw new ApiError(409, 'SUBMISSION_NOT_UNDER_REVIEW', 'La entrega debe estar en revisión.');
      case 'rubric_criterion_invalid':
        throw new ApiError(422, 'RUBRIC_CRITERION_INVALID', 'El criterio de rúbrica no pertenece a la consigna.', {
          criterionId: result.invalidCriterionId,
        });
      case 'score_exceeds_max':
        throw new ApiError(422, 'SCORE_EXCEEDS_MAX', 'El puntaje asignado supera el máximo del criterio.', {
          criterionId: result.criterionId,
          maxScore: result.maxScore,
        });
    }
  }

  async returnSubmission(principal: AuthPrincipal, command: ReturnSubmissionCommand): Promise<SubmissionView> {
    const reason = command.reason.trim();
    if (reason.length < 3 || reason.length > 1_000) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'No pudimos procesar los datos enviados.', {
        fields: ['reason'],
      });
    }

    const result = await this.mutations.returnSubmission({
      actorIsAdmin: principal.roles.includes('ADMIN'),
      actorUserId: principal.userId,
      deliverableId: command.deliverableId,
      expectedVersion: command.expectedVersion,
      organizationId: principal.organization.id,
      reason,
      submissionId: command.submissionId,
      traceId: command.traceId,
    });

    switch (result.kind) {
      case 'returned':
        return result.returnedSubmission;
      case 'not_found':
        throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'No encontramos el recurso solicitado.');
      case 'forbidden':
        throw new ApiError(403, 'FORBIDDEN', 'No tienes permiso para realizar esta acción.');
      case 'conflict':
        throw new ApiError(
          409,
          'VERSION_CONFLICT',
          'El recurso cambió. Actualiza e inténtalo otra vez.',
        );
      case 'submission_not_under_review':
        throw new ApiError(409, 'SUBMISSION_NOT_UNDER_REVIEW', 'La entrega debe estar en revisión.');
    }
  }

  async getTopCandidates(principal: AuthPrincipal, assignmentId: string): Promise<TopCandidatesView> {
    const candidates = await this.repository.getTopCandidates(principal, assignmentId);
    if (candidates === null) {
      throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'No encontramos la consigna solicitada.');
    }
    return candidates;
  }

  async setTopCandidates(principal: AuthPrincipal, command: SetTopCandidatesCommand): Promise<TopCandidatesView> {
    const result = await this.mutations.setTopCandidates({
      actorIsAdmin: principal.roles.includes('ADMIN'),
      actorUserId: principal.userId,
      assignmentId: command.assignmentId,
      candidates: command.candidates,
      expectedVersion: command.expectedVersion,
      organizationId: principal.organization.id,
      traceId: command.traceId,
    });

    switch (result.kind) {
      case 'updated':
        return result.topCandidates;
      case 'not_found':
        throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'No encontramos el recurso solicitado.');
      case 'forbidden':
        throw new ApiError(403, 'FORBIDDEN', 'No tienes permiso para realizar esta acción.');
      case 'conflict':
        throw new ApiError(
          409,
          'VERSION_CONFLICT',
          'El recurso cambió. Actualiza e inténtalo otra vez.',
        );
      case 'invalid_rank':
        throw new ApiError(422, 'INVALID_RANK', 'Los rangos deben ser números únicos de 1 a 3.');
      case 'submission_not_evaluated':
        throw new ApiError(422, 'SUBMISSION_NOT_EVALUATED', 'Solo entregas evaluadas pueden ser seleccionadas.', {
          submissionId: result.submissionId,
        });
    }
  }
}
