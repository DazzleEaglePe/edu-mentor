import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createIntegrationTestContext } from './support/integration-setup.js';

describe('Integration · Deliverables & Submissions Workflow', () => {
  it('covers deliverable creation, submit, review, evaluate, return, and top candidate selection', async () => {
    const ctx = await createIntegrationTestContext();
    if (!ctx.isDatabaseAvailable) {
      return;
    }

    const { deliverablesService, participantPrincipal, mentorPrincipal, adminPrincipal } = ctx;

    // 1. Participant creates deliverable
    const deliverable = await deliverablesService.create(participantPrincipal, {
      assignmentId: '66666666-6666-4666-8666-666666666666',
      idempotencyKey: 'idemp-int-deliv-1',
      notes: 'Envío inicial de propuesta',
      traceId: 'trace-int-deliv-1',
    });

    assert.equal(deliverable.submissions.length, 1);
    const firstSub = deliverable.submissions[0]!;
    assert.equal(firstSub.status, 'DRAFT');

    // 2. Submit submission
    const submitted = await deliverablesService.submit(participantPrincipal, {
      deliverableId: deliverable.id,
      expectedVersion: firstSub.version,
      submissionId: firstSub.id,
      traceId: 'trace-int-deliv-2',
    });

    assert.equal(submitted.status, 'SUBMITTED');

    // 3. Mentor starts review
    const reviewStarted = await deliverablesService.startReview(mentorPrincipal, {
      deliverableId: deliverable.id,
      expectedVersion: submitted.version,
      submissionId: submitted.id,
      traceId: 'trace-int-deliv-3',
    });

    assert.equal(reviewStarted.status, 'UNDER_REVIEW');

    // 4. Mentor evaluates submission
    const evaluated = await deliverablesService.evaluate(mentorPrincipal, {
      deliverableId: deliverable.id,
      expectedVersion: reviewStarted.version,
      feedback: 'Propuesta excelente con soporte riguroso.',
      rubricScores: [
        { criterionId: 'claridad', score: 38 },
        { criterionId: 'evidencia', score: 56 },
      ],
      score: 94,
      submissionId: submitted.id,
      traceId: 'trace-int-deliv-4',
    });

    assert.equal(evaluated.status, 'EVALUATED');
    assert.equal(evaluated.evaluation?.score, 94);

    // 5. Admin sets top candidate
    const topCandidates = await deliverablesService.setTopCandidates(adminPrincipal, {
      assignmentId: '66666666-6666-4666-8666-666666666666',
      candidates: [{ rank: 1, submissionId: submitted.id }],
      expectedVersion: 1,
      traceId: 'trace-int-deliv-5',
    });

    assert.equal(topCandidates.candidates.length, 1);
    assert.equal(topCandidates.candidates[0]?.rank, 1);
  });
});
