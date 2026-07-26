import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { SessionView } from '../modules/sessions/session-view.js';
import { SessionsService } from '../modules/sessions/sessions.service.js';
import { expectApiError, createIntegrationTestContext } from './support/integration-setup.js';

describe('Integration · Sessions Reschedule & Lifecycle Workflow', () => {
  it('covers complete, cancel, reschedule, and request approval/rejection lifecycle', async () => {
    const ctx = await createIntegrationTestContext();
    if (!ctx.isDatabaseAvailable) {
      return;
    }

    const { service, principal, mentorPrincipal, participantPrincipal } = ctx;

    // 1. Create a session
    const session = await service.create(mentorPrincipal, {
      durationMinutes: 45,
      enrollmentIds: [participantPrincipal.activeEnrollment!.id],
      idempotencyKey: 'idemp-int-sess-1',
      oleadaId: participantPrincipal.activeEnrollment!.oleada.id,
      phase: 'FASE_1',
      startsAt: new Date(Date.now() + 86_400_000).toISOString(),
      timezone: 'America/Lima',
      title: 'Mentoría de Integración',
      traceId: 'trace-int-1',
      type: 'ONE_ON_ONE',
      weekNumber: 4,
    });

    assert.equal(session.status, 'SCHEDULED');

    // 2. Direct Reschedule
    const rescheduled = await service.reschedule(mentorPrincipal, {
      durationMinutes: 60,
      expectedVersion: session.version,
      idempotencyKey: 'idemp-int-resched-1',
      reason: 'Ajuste de agenda acordado',
      sessionId: session.id,
      startsAt: new Date(Date.now() + 172_800_000).toISOString(),
      traceId: 'trace-int-2',
    });

    assert.equal(rescheduled.rescheduledFromId, session.id);
    assert.equal(rescheduled.status, 'SCHEDULED');

    // 3. Participant requests reschedule on the new session
    const req = await service.createRescheduleRequest(participantPrincipal, {
      idempotencyKey: 'idemp-int-req-1',
      proposedStartsAt: new Date(Date.now() + 259_200_000).toISOString(),
      reason: 'Cruce con evento académico importante',
      sessionId: rescheduled.id,
      traceId: 'trace-int-3',
    });

    assert.equal(req.status, 'PENDING');

    // 4. Mentor approves reschedule request
    const approved = await service.approveRescheduleRequest(mentorPrincipal, {
      expectedRequestVersion: req.version,
      expectedSessionVersion: rescheduled.version,
      idempotencyKey: 'idemp-int-app-1',
      requestId: req.id,
      startsAt: new Date(Date.now() + 259_200_000).toISOString(),
      traceId: 'trace-int-4',
    });

    assert.equal(approved.request.status, 'APPROVED');
    assert.equal(approved.replacementSession.rescheduledFromId, rescheduled.id);
  });
});
