import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';

import { Roles } from '../../common/auth/auth-metadata.js';
import type { AuthPrincipal } from '../../common/auth/auth-principal.js';
import type { AuthenticatedRequest } from '../../common/auth/authenticated-request.js';
import { getOrCreateTraceId } from '../../common/http/trace-id.js';
import { createValidationPipe } from '../../configure-http-app.js';
import { CreateDeliverableDto } from './dto/create-deliverable.dto.js';
import { EvaluateSubmissionDto } from './dto/evaluate-submission.dto.js';
import { ReturnSubmissionDto } from './dto/return-submission.dto.js';
import { SetTopCandidatesDto } from './dto/set-top-candidates.dto.js';
import type { DeliverableDetailView, DeliverablePage, SubmissionView, TopCandidatesView } from './deliverable-view.js';
import { DeliverablesService } from './deliverables.service.js';

function requirePrincipal(request: AuthenticatedRequest): AuthPrincipal {
  if (request.auth === undefined) {
    throw new Error('Authenticated request is missing its principal.');
  }

  return request.auth;
}

@Controller()
export class DeliverablesController {
  constructor(@Inject(DeliverablesService) private readonly deliverables: DeliverablesService) {}

  @Get('deliverables')
  list(
    @Query('page') pageRaw: string | undefined,
    @Query('limit') limitRaw: string | undefined,
    @Query('status') status: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'EVALUATED' | 'RETURNED' | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<DeliverablePage> {
    const page = pageRaw === undefined ? 1 : Number.parseInt(pageRaw, 10) || 1;
    const limit = limitRaw === undefined ? 20 : Number.parseInt(limitRaw, 10) || 20;

    return this.deliverables.list(requirePrincipal(request), { limit, page, status });
  }

  @Post('deliverables')
  @HttpCode(201)
  @Roles('PARTICIPANT')
  create(
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body(createValidationPipe(CreateDeliverableDto)) body: CreateDeliverableDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<DeliverableDetailView> {
    return this.deliverables.create(requirePrincipal(request), {
      assignmentId: body.assignmentId,
      idempotencyKey,
      notes: body.notes,
      traceId: getOrCreateTraceId(request),
    });
  }

  @Get('deliverables/pending-review')
  @Roles('ADMIN', 'MENTOR')
  listPendingReviews(
    @Query('page') pageRaw: string | undefined,
    @Query('limit') limitRaw: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<DeliverablePage> {
    const page = pageRaw === undefined ? 1 : Number.parseInt(pageRaw, 10) || 1;
    const limit = limitRaw === undefined ? 20 : Number.parseInt(limitRaw, 10) || 20;

    return this.deliverables.listPendingReviews(requirePrincipal(request), page, limit);
  }

  @Get('deliverables/:deliverableId')
  get(
    @Param('deliverableId', new ParseUUIDPipe({ version: '4' })) deliverableId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<DeliverableDetailView> {
    return this.deliverables.get(requirePrincipal(request), deliverableId);
  }

  @Post('deliverables/:deliverableId/submissions/:submissionId/submit')
  @HttpCode(200)
  @Roles('PARTICIPANT')
  submit(
    @Param('deliverableId', new ParseUUIDPipe({ version: '4' })) deliverableId: string,
    @Param('submissionId', new ParseUUIDPipe({ version: '4' })) submissionId: string,
    @Body('expectedVersion') expectedVersion: number,
    @Req() request: AuthenticatedRequest,
  ): Promise<SubmissionView> {
    return this.deliverables.submit(requirePrincipal(request), {
      deliverableId,
      expectedVersion,
      submissionId,
      traceId: getOrCreateTraceId(request),
    });
  }

  @Post('deliverables/:deliverableId/submissions/:submissionId/start-review')
  @HttpCode(200)
  @Roles('ADMIN', 'MENTOR')
  startReview(
    @Param('deliverableId', new ParseUUIDPipe({ version: '4' })) deliverableId: string,
    @Param('submissionId', new ParseUUIDPipe({ version: '4' })) submissionId: string,
    @Body('expectedVersion') expectedVersion: number,
    @Req() request: AuthenticatedRequest,
  ): Promise<SubmissionView> {
    return this.deliverables.startReview(requirePrincipal(request), {
      deliverableId,
      expectedVersion,
      submissionId,
      traceId: getOrCreateTraceId(request),
    });
  }

  @Post('deliverables/:deliverableId/submissions/:submissionId/evaluation')
  @HttpCode(200)
  @Roles('ADMIN', 'MENTOR')
  evaluate(
    @Param('deliverableId', new ParseUUIDPipe({ version: '4' })) deliverableId: string,
    @Param('submissionId', new ParseUUIDPipe({ version: '4' })) submissionId: string,
    @Body(createValidationPipe(EvaluateSubmissionDto)) body: EvaluateSubmissionDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<SubmissionView> {
    return this.deliverables.evaluate(requirePrincipal(request), {
      deliverableId,
      expectedVersion: body.expectedVersion,
      feedback: body.feedback,
      rubricScores: body.rubricScores,
      score: body.score,
      submissionId,
      traceId: getOrCreateTraceId(request),
    });
  }

  @Post('deliverables/:deliverableId/submissions/:submissionId/return')
  @HttpCode(200)
  @Roles('ADMIN', 'MENTOR')
  returnSubmission(
    @Param('deliverableId', new ParseUUIDPipe({ version: '4' })) deliverableId: string,
    @Param('submissionId', new ParseUUIDPipe({ version: '4' })) submissionId: string,
    @Body(createValidationPipe(ReturnSubmissionDto)) body: ReturnSubmissionDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<SubmissionView> {
    return this.deliverables.returnSubmission(requirePrincipal(request), {
      deliverableId,
      expectedVersion: 1,
      reason: body.reason,
      submissionId,
      traceId: getOrCreateTraceId(request),
    });
  }

  @Get('assignments/:assignmentId/top-candidates')
  getTopCandidates(
    @Param('assignmentId', new ParseUUIDPipe({ version: '4' })) assignmentId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<TopCandidatesView> {
    return this.deliverables.getTopCandidates(requirePrincipal(request), assignmentId);
  }

  @Put('assignments/:assignmentId/top-candidates')
  @Roles('ADMIN')
  setTopCandidates(
    @Param('assignmentId', new ParseUUIDPipe({ version: '4' })) assignmentId: string,
    @Body(createValidationPipe(SetTopCandidatesDto)) body: SetTopCandidatesDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<TopCandidatesView> {
    return this.deliverables.setTopCandidates(requirePrincipal(request), {
      assignmentId,
      candidates: body.candidates,
      expectedVersion: body.expectedVersion,
      traceId: getOrCreateTraceId(request),
    });
  }
}
