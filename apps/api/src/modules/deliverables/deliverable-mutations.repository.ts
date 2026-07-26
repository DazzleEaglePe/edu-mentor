import { Inject, Injectable } from '@nestjs/common';

import {
  IDEMPOTENCY_RETENTION_MS,
  reserveIdempotency,
  storeIdempotentResponse,
} from '../../common/idempotency/idempotency-key.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import type {
  CreateDeliverableInput,
  CreateDeliverableResult,
  EvaluateSubmissionInput,
  EvaluateSubmissionResult,
  ReturnSubmissionInput,
  ReturnSubmissionResult,
  SetTopCandidatesInput,
  SetTopCandidatesResult,
  StartReviewInput,
  StartReviewResult,
  SubmitSubmissionInput,
  SubmitSubmissionResult,
} from './deliverable-mutation.ts';
import {
  deliverableInclude,
  toDeliverableDetailView,
  toSubmissionView,
  type DeliverableWithRelations,
} from './deliverables.repository.js';

class DeliverableMutationAbort {
  constructor(readonly result: unknown) {}
}

@Injectable()
export class DeliverableMutationsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(input: CreateDeliverableInput): Promise<CreateDeliverableResult> {
    const expiresAt = input.expiresAt;
    const operation = 'deliverables.create';

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const reservation = await reserveIdempotency(transaction, {
          expiresAt,
          keyHash: input.idempotencyKeyHash,
          operation,
          organizationId: input.organizationId,
          requestHash: input.requestHash,
        });

        if (reservation.kind === 'reused') {
          return { kind: 'idempotency_key_reused' };
        }

        if (reservation.kind === 'replay') {
          const deliverable = reservation.responseBody as unknown as import('./deliverable-view.js').DeliverableDetailView;
          return { deliverable, kind: 'replayed' };
        }

        const assignment = await transaction.assignment.findFirst({
          where: {
            id: input.assignmentId,
            oleada: { organizationId: input.organizationId },
          },
        });

        if (assignment === null) {
          throw new DeliverableMutationAbort({ kind: 'assignment_not_found' });
        }

        const enrollment = await transaction.enrollment.findFirst({
          where: {
            oleadaId: assignment.oleadaId,
            userId: input.actorUserId,
          },
        });

        if (enrollment === null) {
          throw new DeliverableMutationAbort({ kind: 'enrollment_not_found' });
        }

        const existing = await transaction.deliverable.findUnique({
          where: {
            assignmentId_enrollmentId: {
              assignmentId: input.assignmentId,
              enrollmentId: enrollment.id,
            },
          },
        });

        if (existing !== null) {
          throw new DeliverableMutationAbort({ kind: 'deliverable_already_exists' });
        }

        const deliverableRecord = await transaction.deliverable.create({
          data: {
            assignmentId: input.assignmentId,
            enrollmentId: enrollment.id,
            submissions: {
              create: {
                notes: input.notes,
                revisionNumber: 1,
                status: 'DRAFT',
              },
            },
          },
          include: deliverableInclude,
        });

        const firstSubmission = deliverableRecord.submissions[0];

        if (firstSubmission !== undefined) {
          await transaction.deliverable.update({
            data: { currentSubmissionId: firstSubmission.id },
            where: { id: deliverableRecord.id },
          });
        }

        const reloaded = await transaction.deliverable.findUniqueOrThrow({
          include: deliverableInclude,
          where: { id: deliverableRecord.id },
        });

        const deliverable = toDeliverableDetailView(reloaded);

        await storeIdempotentResponse(transaction, reservation.id, 201, deliverable);

        await transaction.auditLog.create({
          data: {
            action: 'deliverable.created',
            actorUserId: input.actorUserId,
            afterData: deliverable as unknown as Prisma.InputJsonValue,
            beforeData: null as unknown as Prisma.InputJsonValue,
            entityId: deliverableRecord.id,
            entityType: 'DELIVERABLE',
            organizationId: input.organizationId,
            traceId: input.traceId,
          },
        });

        return { deliverable, kind: 'created' };
      });
    } catch (error) {
      if (error instanceof DeliverableMutationAbort) {
        return error.result as CreateDeliverableResult;
      }
      throw error;
    }
  }

  async submit(input: SubmitSubmissionInput): Promise<SubmitSubmissionResult> {
    return this.prisma.$transaction(async (transaction) => {
      const submissionRecord = await transaction.deliverableSubmission.findFirst({
        include: {
          deliverable: {
            include: {
              assignment: { select: { oleada: { select: { organizationId: true } } } },
              enrollment: { select: { userId: true } },
            },
          },
          files: true,
        },
        where: {
          deliverableId: input.deliverableId,
          id: input.submissionId,
          deliverable: {
            assignment: { oleada: { organizationId: input.organizationId } },
          },
        },
      });

      if (submissionRecord === null) {
        return { kind: 'not_found' };
      }

      if (submissionRecord.deliverable.enrollment.userId !== input.actorUserId) {
        return { kind: 'forbidden' };
      }

      if (submissionRecord.version !== input.expectedVersion) {
        return { currentVersion: submissionRecord.version, kind: 'conflict' };
      }

      if (submissionRecord.status !== 'DRAFT') {
        return { kind: 'submission_not_draft' };
      }

      if (submissionRecord.files.some((f) => f.scanStatus !== 'CLEAN')) {
        return { kind: 'files_not_clean' };
      }

      const now = new Date();
      const updatedRecord = await transaction.deliverableSubmission.update({
        data: {
          status: 'SUBMITTED',
          submittedAt: now,
          version: { increment: 1 },
        },
        include: deliverableInclude.submissions.include,
        where: { id: input.submissionId },
      });

      const submission = toSubmissionView(updatedRecord);

      await transaction.auditLog.create({
        data: {
          action: 'deliverable.submission_submitted',
          actorUserId: input.actorUserId,
          afterData: submission as unknown as Prisma.InputJsonValue,
          beforeData: toSubmissionView(submissionRecord) as unknown as Prisma.InputJsonValue,
          entityId: input.submissionId,
          entityType: 'DELIVERABLE_SUBMISSION',
          organizationId: input.organizationId,
          traceId: input.traceId,
        },
      });

      return { kind: 'submitted', submission };
    });
  }

  async startReview(input: StartReviewInput): Promise<StartReviewResult> {
    return this.prisma.$transaction(async (transaction) => {
      const submissionRecord = await transaction.deliverableSubmission.findFirst({
        include: {
          deliverable: {
            include: {
              assignment: { select: { oleada: { select: { organizationId: true } } } },
            },
          },
          files: true,
          evaluation: true,
        },
        where: {
          deliverableId: input.deliverableId,
          id: input.submissionId,
          deliverable: {
            assignment: { oleada: { organizationId: input.organizationId } },
          },
        },
      });

      if (submissionRecord === null) {
        return { kind: 'not_found' };
      }

      if (submissionRecord.version !== input.expectedVersion) {
        return { currentVersion: submissionRecord.version, kind: 'conflict' };
      }

      if (submissionRecord.status !== 'SUBMITTED') {
        return { kind: 'submission_not_submitted' };
      }

      const updatedRecord = await transaction.deliverableSubmission.update({
        data: {
          status: 'UNDER_REVIEW',
          version: { increment: 1 },
        },
        include: deliverableInclude.submissions.include,
        where: { id: input.submissionId },
      });

      const submission = toSubmissionView(updatedRecord);

      await transaction.auditLog.create({
        data: {
          action: 'deliverable.submission_review_started',
          actorUserId: input.actorUserId,
          afterData: submission as unknown as Prisma.InputJsonValue,
          beforeData: toSubmissionView(submissionRecord) as unknown as Prisma.InputJsonValue,
          entityId: input.submissionId,
          entityType: 'DELIVERABLE_SUBMISSION',
          organizationId: input.organizationId,
          traceId: input.traceId,
        },
      });

      return { kind: 'started', submission };
    });
  }

  async evaluate(input: EvaluateSubmissionInput): Promise<EvaluateSubmissionResult> {
    return this.prisma.$transaction(async (transaction) => {
      const submissionRecord = await transaction.deliverableSubmission.findFirst({
        include: {
          deliverable: {
            include: {
              assignment: {
                include: {
                  rubricCriteria: true,
                  oleada: { select: { organizationId: true } },
                },
              },
            },
          },
          files: true,
          evaluation: true,
        },
        where: {
          deliverableId: input.deliverableId,
          id: input.submissionId,
          deliverable: {
            assignment: { oleada: { organizationId: input.organizationId } },
          },
        },
      });

      if (submissionRecord === null) {
        return { kind: 'not_found' };
      }

      if (submissionRecord.version !== input.expectedVersion) {
        return { currentVersion: submissionRecord.version, kind: 'conflict' };
      }

      if (submissionRecord.status !== 'UNDER_REVIEW') {
        return { kind: 'submission_not_under_review' };
      }

      const criteriaMap = new Map(
        submissionRecord.deliverable.assignment.rubricCriteria.map((c) => [c.key, c.maxScore]),
      );

      for (const rs of input.rubricScores) {
        const maxScore = criteriaMap.get(rs.criterionId);
        if (maxScore === undefined) {
          return { invalidCriterionId: rs.criterionId, kind: 'rubric_criterion_invalid' };
        }
        if (rs.score > maxScore) {
          return { criterionId: rs.criterionId, kind: 'score_exceeds_max', maxScore };
        }
      }

      const now = new Date();

      const evaluationRecord = await transaction.submissionEvaluation.create({
        data: {
          evaluatedAt: now,
          feedback: input.feedback,
          mentorUserId: input.actorUserId,
          score: input.score,
          submissionId: input.submissionId,
          rubricScores: {
            createMany: {
              data: input.rubricScores.map((rs) => ({
                comment: rs.comment ?? null,
                criterionKey: rs.criterionId,
                score: rs.score,
              })),
            },
          },
        },
        include: {
          mentor: { select: { fullName: true, id: true } },
          rubricScores: true,
        },
      });

      const updatedSubmissionRecord = await transaction.deliverableSubmission.update({
        data: {
          status: 'EVALUATED',
          version: { increment: 1 },
        },
        include: deliverableInclude.submissions.include,
        where: { id: input.submissionId },
      });

      const submission = toSubmissionView(updatedSubmissionRecord);
      const evaluation = submission.evaluation!;

      await transaction.auditLog.create({
        data: {
          action: 'deliverable.submission_evaluated',
          actorUserId: input.actorUserId,
          afterData: submission as unknown as Prisma.InputJsonValue,
          beforeData: toSubmissionView(submissionRecord) as unknown as Prisma.InputJsonValue,
          entityId: input.submissionId,
          entityType: 'DELIVERABLE_SUBMISSION',
          organizationId: input.organizationId,
          traceId: input.traceId,
        },
      });

      return { evaluation, kind: 'evaluated', submission };
    });
  }

  async returnSubmission(input: ReturnSubmissionInput): Promise<ReturnSubmissionResult> {
    return this.prisma.$transaction(async (transaction) => {
      const submissionRecord = await transaction.deliverableSubmission.findFirst({
        include: {
          deliverable: {
            include: {
              assignment: { select: { oleada: { select: { organizationId: true } } } },
            },
          },
          files: true,
          evaluation: true,
        },
        where: {
          deliverableId: input.deliverableId,
          id: input.submissionId,
          deliverable: {
            assignment: { oleada: { organizationId: input.organizationId } },
          },
        },
      });

      if (submissionRecord === null) {
        return { kind: 'not_found' };
      }

      if (submissionRecord.version !== input.expectedVersion) {
        return { currentVersion: submissionRecord.version, kind: 'conflict' };
      }

      if (submissionRecord.status !== 'UNDER_REVIEW') {
        return { kind: 'submission_not_under_review' };
      }

      const returnedRecord = await transaction.deliverableSubmission.update({
        data: {
          status: 'RETURNED',
          version: { increment: 1 },
        },
        include: deliverableInclude.submissions.include,
        where: { id: input.submissionId },
      });

      const nextSubmissionRecord = await transaction.deliverableSubmission.create({
        data: {
          deliverableId: input.deliverableId,
          notes: '',
          previousSubmissionId: input.submissionId,
          revisionNumber: submissionRecord.revisionNumber + 1,
          status: 'DRAFT',
        },
        include: deliverableInclude.submissions.include,
      });

      await transaction.deliverable.update({
        data: { currentSubmissionId: nextSubmissionRecord.id },
        where: { id: input.deliverableId },
      });

      const returnedSubmission = toSubmissionView(returnedRecord);
      const nextSubmission = toSubmissionView(nextSubmissionRecord);

      await transaction.auditLog.create({
        data: {
          action: 'deliverable.submission_returned',
          actorUserId: input.actorUserId,
          afterData: {
            nextSubmissionId: nextSubmissionRecord.id,
            reason: input.reason,
          } as unknown as Prisma.InputJsonValue,
          beforeData: returnedSubmission as unknown as Prisma.InputJsonValue,
          entityId: input.submissionId,
          entityType: 'DELIVERABLE_SUBMISSION',
          organizationId: input.organizationId,
          traceId: input.traceId,
        },
      });

      return { kind: 'returned', nextSubmission, returnedSubmission };
    });
  }

  async setTopCandidates(input: SetTopCandidatesInput): Promise<SetTopCandidatesResult> {
    return this.prisma.$transaction(async (transaction) => {
      const assignment = await transaction.assignment.findFirst({
        where: {
          id: input.assignmentId,
          oleada: { organizationId: input.organizationId },
        },
      });

      if (assignment === null) {
        return { kind: 'not_found' };
      }

      if (!input.actorIsAdmin) {
        return { kind: 'forbidden' };
      }

      if (assignment.version !== input.expectedVersion) {
        return { currentVersion: assignment.version, kind: 'conflict' };
      }

      const ranks = new Set(input.candidates.map((c) => c.rank));
      if (input.candidates.some((c) => c.rank < 1 || c.rank > 3) || ranks.size !== input.candidates.length) {
        return { kind: 'invalid_rank' };
      }

      for (const candidate of input.candidates) {
        const sub = await transaction.deliverableSubmission.findFirst({
          where: {
            id: candidate.submissionId,
            deliverable: { assignmentId: input.assignmentId },
          },
        });

        if (sub === null || sub.status !== 'EVALUATED') {
          return { kind: 'submission_not_evaluated', submissionId: candidate.submissionId };
        }
      }

      await transaction.assignmentTopCandidate.deleteMany({
        where: { assignmentId: input.assignmentId },
      });

      if (input.candidates.length > 0) {
        await transaction.assignmentTopCandidate.createMany({
          data: input.candidates.map((c) => ({
            assignmentId: input.assignmentId,
            rank: c.rank,
            selectedById: input.actorUserId,
            submissionId: c.submissionId,
          })),
        });
      }

      const updatedAssignment = await transaction.assignment.update({
        data: { version: { increment: 1 } },
        include: { topCandidates: { orderBy: { rank: 'asc' } } },
        where: { id: input.assignmentId },
      });

      const topCandidates: import('./deliverable-view.js').TopCandidatesView = {
        assignmentId: updatedAssignment.id,
        candidates: updatedAssignment.topCandidates.map((c) => ({
          rank: c.rank,
          submissionId: c.submissionId,
        })),
        provisionalRule: true,
        version: updatedAssignment.version,
      };

      await transaction.auditLog.create({
        data: {
          action: 'assignment.top_candidates_updated',
          actorUserId: input.actorUserId,
          afterData: topCandidates as unknown as Prisma.InputJsonValue,
          beforeData: null as unknown as Prisma.InputJsonValue,
          entityId: input.assignmentId,
          entityType: 'ASSIGNMENT',
          organizationId: input.organizationId,
          traceId: input.traceId,
        },
      });

      return { kind: 'updated', topCandidates };
    });
  }
}
