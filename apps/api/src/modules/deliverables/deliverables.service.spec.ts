import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AuthPrincipal } from '../../common/auth/auth-principal.js';
import { ApiError } from '../../common/http/api-error.js';
import type { DeliverablesRepository } from './deliverables.repository.js';
import type { DeliverableMutationsRepository } from './deliverable-mutations.repository.js';
import type { IdempotencyFingerprintService } from '../../common/idempotency/idempotency-fingerprint.service.js';
import { DeliverablesService } from './deliverables.service.js';
import type { DeliverableDetailView, SubmissionView } from './deliverable-view.js';

const ORGANIZATION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const DELIVERABLE_ID = '55555555-5555-4555-8555-555555555555';
const SUBMISSION_ID = '77777777-7777-4777-8777-777777777777';

const principal: AuthPrincipal = {
  activeEnrollment: null,
  email: 'participant@example.test',
  fullName: 'Participant',
  mentorCapabilities: [],
  mustChangePassword: false,
  organization: {
    id: ORGANIZATION_ID,
    name: 'Organization',
  },
  roles: ['PARTICIPANT'],
  sessionId: '77777777-7777-4777-8777-777777777777',
  userId: USER_ID,
};

const submission: SubmissionView = {
  evaluation: null,
  files: [],
  id: SUBMISSION_ID,
  notes: 'Notas de entrega',
  previousSubmissionId: null,
  revisionNumber: 1,
  status: 'DRAFT',
  submittedAt: null,
  version: 1,
};

const deliverableDetail: DeliverableDetailView = {
  assignment: {
    dueAt: '2026-08-15T04:59:59.000Z',
    id: '66666666-6666-4666-8666-666666666666',
    instructions: 'Instrucciones',
    isActive: true,
    maxScore: 100,
    oleada: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Oleada' },
    rubric: [
      { description: 'Claridad', id: 'claridad', label: 'Claridad', maxScore: 40 },
      { description: 'Evidencia', id: 'evidencia', label: 'Evidencia', maxScore: 60 },
    ],
    title: 'Consigna',
    version: 1,
    weekNumber: 4,
  },
  currentSubmissionId: SUBMISSION_ID,
  enrollmentId: '22222222-2222-4222-8222-222222222222',
  id: DELIVERABLE_ID,
  submissions: [submission],
};

function createService(
  deliverablesRepoOverridden?: Partial<DeliverablesRepository>,
  mutationsRepoOverridden?: Partial<DeliverableMutationsRepository>,
) {
  const repository = {
    findById: async () => deliverableDetail,
    getTopCandidates: async () => ({
      assignmentId: '66666666-6666-4666-8666-666666666666',
      candidates: [],
      provisionalRule: true,
      version: 1,
    }),
    list: async () => ({
      data: [deliverableDetail],
      meta: { hasNextPage: false, limit: 20, page: 1, total: 1 },
    }),
    listPendingReviews: async () => ({
      data: [deliverableDetail],
      meta: { hasNextPage: false, limit: 20, page: 1, total: 1 },
    }),
    ...deliverablesRepoOverridden,
  };

  const mutations = {
    create: async () => ({ deliverable: deliverableDetail, kind: 'created' }),
    evaluate: async () => ({
      evaluation: {
        evaluatedAt: '2026-08-14T21:30:00.000Z',
        feedback: 'Sólido',
        id: '99999999-9999-4999-8999-999999999999',
        mentor: { fullName: 'Mentora', id: USER_ID },
        rubricScores: [
          { criterionId: 'claridad', score: 36 },
          { criterionId: 'evidencia', score: 54 },
        ],
        score: 90,
        submissionId: SUBMISSION_ID,
      },
      kind: 'evaluated',
      submission: { ...submission, status: 'EVALUATED' },
    }),
    returnSubmission: async () => ({
      kind: 'returned',
      nextSubmission: { ...submission, revisionNumber: 2 },
      returnedSubmission: { ...submission, status: 'RETURNED' },
    }),
    setTopCandidates: async () => ({
      kind: 'updated',
      topCandidates: {
        assignmentId: '66666666-6666-4666-8666-666666666666',
        candidates: [{ rank: 1, submissionId: SUBMISSION_ID }],
        provisionalRule: true,
        version: 2,
      },
    }),
    startReview: async () => ({
      kind: 'started',
      submission: { ...submission, status: 'UNDER_REVIEW' },
    }),
    submit: async () => ({
      kind: 'submitted',
      submission: { ...submission, status: 'SUBMITTED' },
    }),
    ...mutationsRepoOverridden,
  };

  const fingerprints = {
    hashIdempotencyKey: () => 'key-hash',
    hashRequest: () => 'request-hash',
  };

  return new DeliverablesService(
    repository as unknown as DeliverablesRepository,
    mutations as unknown as DeliverableMutationsRepository,
    fingerprints as unknown as IdempotencyFingerprintService,
  );
}

async function expectApiError(
  promise: Promise<unknown>,
  statusCode: number,
  code: string,
): Promise<ApiError> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );

  assert.ok(error instanceof ApiError);
  assert.equal(error.getStatus(), statusCode);
  assert.equal(error.code, code);
  return error;
}

describe('DeliverablesService', () => {
  it('handles deliverable creation and detail lookup', async () => {
    const service = createService();
    const deliverable = await service.create(principal, {
      assignmentId: '66666666-6666-4666-8666-666666666666',
      idempotencyKey: 'idemp-deliv-1',
      notes: 'Primer borrador de entregable',
      traceId: 'trace-create-deliv',
    });

    assert.equal(deliverable.id, DELIVERABLE_ID);

    const retrieved = await service.get(principal, DELIVERABLE_ID);
    assert.equal(retrieved.id, DELIVERABLE_ID);
  });

  it('handles submission submit, startReview, evaluate, and return workflows', async () => {
    const service = createService();
    const mentor: AuthPrincipal = { ...principal, roles: ['MENTOR'] };

    const submitted = await service.submit(principal, {
      deliverableId: DELIVERABLE_ID,
      expectedVersion: 1,
      submissionId: SUBMISSION_ID,
      traceId: 'trace-sub',
    });
    assert.equal(submitted.status, 'SUBMITTED');

    const reviewStarted = await service.startReview(mentor, {
      deliverableId: DELIVERABLE_ID,
      expectedVersion: 1,
      submissionId: SUBMISSION_ID,
      traceId: 'trace-review',
    });
    assert.equal(reviewStarted.status, 'UNDER_REVIEW');

    const evaluated = await service.evaluate(mentor, {
      deliverableId: DELIVERABLE_ID,
      expectedVersion: 1,
      feedback: 'Retroalimentación detallada y constructiva para el participante.',
      rubricScores: [
        { criterionId: 'claridad', score: 36 },
        { criterionId: 'evidencia', score: 54 },
      ],
      score: 90,
      submissionId: SUBMISSION_ID,
      traceId: 'trace-eval',
    });
    assert.equal(evaluated.status, 'EVALUATED');

    const returned = await service.returnSubmission(mentor, {
      deliverableId: DELIVERABLE_ID,
      expectedVersion: 1,
      reason: 'Por favor ajusta la sección de evidencia.',
      submissionId: SUBMISSION_ID,
      traceId: 'trace-ret',
    });
    assert.equal(returned.status, 'RETURNED');
  });

  it('validates rubric maxScore and error code', async () => {
    const mentor: AuthPrincipal = { ...principal, roles: ['MENTOR'] };
    const service = createService(undefined, {
      evaluate: async () => ({
        criterionId: 'claridad',
        kind: 'score_exceeds_max',
        maxScore: 40,
      }),
    });

    const error = await expectApiError(
      service.evaluate(mentor, {
        deliverableId: DELIVERABLE_ID,
        expectedVersion: 1,
        feedback: 'Retroalimentación detallada y constructiva para el participante.',
        rubricScores: [{ criterionId: 'claridad', score: 50 }],
        score: 50,
        submissionId: SUBMISSION_ID,
        traceId: 'trace-eval',
      }),
      422,
      'SCORE_EXCEEDS_MAX',
    );

    assert.deepEqual(error.details, {
      criterionId: 'claridad',
      maxScore: 40,
    });
  });

  it('handles top candidates retrieval and update', async () => {
    const admin: AuthPrincipal = { ...principal, roles: ['ADMIN'] };
    const service = createService();

    const candidates = await service.getTopCandidates(admin, '66666666-6666-4666-8666-666666666666');
    assert.equal(candidates.provisionalRule, true);

    const updated = await service.setTopCandidates(admin, {
      assignmentId: '66666666-6666-4666-8666-666666666666',
      candidates: [{ rank: 1, submissionId: SUBMISSION_ID }],
      expectedVersion: 1,
      traceId: 'trace-top',
    });
    assert.equal(updated.candidates.length, 1);
  });
});
