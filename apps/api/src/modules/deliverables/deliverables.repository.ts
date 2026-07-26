import { Inject, Injectable } from '@nestjs/common';

import type { AuthPrincipal } from '../../common/auth/auth-principal.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import type {
  DeliverableDetailView,
  DeliverablePage,
  SubmissionView,
  TopCandidatesView,
} from './deliverable-view.js';

export const deliverableInclude = {
  assignment: {
    include: {
      oleada: {
        select: {
          id: true,
          name: true,
        },
      },
      rubricCriteria: {
        orderBy: {
          sortOrder: 'asc',
        },
      },
    },
  },
  submissions: {
    include: {
      evaluation: {
        include: {
          mentor: {
            select: {
              fullName: true,
              id: true,
            },
          },
          rubricScores: true,
        },
      },
      files: true,
    },
    orderBy: {
      revisionNumber: 'asc',
    },
  },
} as const satisfies Prisma.DeliverableInclude;

export type DeliverableWithRelations = Prisma.DeliverableGetPayload<{
  include: typeof deliverableInclude;
}>;

export function toDeliverableDetailView(deliverable: DeliverableWithRelations): DeliverableDetailView {
  return {
    assignment: {
      dueAt: deliverable.assignment.dueAt.toISOString(),
      id: deliverable.assignment.id,
      instructions: deliverable.assignment.instructions,
      isActive: deliverable.assignment.isActive,
      maxScore: deliverable.assignment.maxScore,
      oleada: deliverable.assignment.oleada,
      rubric: deliverable.assignment.rubricCriteria.map((c) => ({
        description: c.description,
        id: c.key,
        label: c.label,
        maxScore: c.maxScore,
      })),
      title: deliverable.assignment.title,
      version: deliverable.assignment.version,
      weekNumber: deliverable.assignment.weekNumber,
    },
    currentSubmissionId: deliverable.currentSubmissionId,
    enrollmentId: deliverable.enrollmentId,
    id: deliverable.id,
    submissions: deliverable.submissions.map(toSubmissionView),
  };
}

export function toSubmissionView(
  sub: DeliverableWithRelations['submissions'][number],
): SubmissionView {
  return {
    evaluation:
      sub.evaluation === null
        ? null
        : {
            evaluatedAt: sub.evaluation.evaluatedAt.toISOString(),
            feedback: sub.evaluation.feedback,
            id: sub.evaluation.id,
            mentor: sub.evaluation.mentor,
            rubricScores: sub.evaluation.rubricScores.map((rs) => ({
              ...(rs.comment === null ? {} : { comment: rs.comment }),
              criterionId: rs.criterionKey,
              score: rs.score,
            })),
            score: sub.evaluation.score,
            submissionId: sub.evaluation.submissionId,
          },
    files: sub.files.map((f) => ({
      detectedMimeType: f.detectedMimeType,
      id: f.id,
      originalName: f.originalName,
      scanStatus: f.scanStatus,
      sizeBytes: f.sizeBytes,
    })),
    id: sub.id,
    notes: sub.notes,
    previousSubmissionId: sub.previousSubmissionId,
    revisionNumber: sub.revisionNumber,
    status: sub.status,
    submittedAt: sub.submittedAt?.toISOString() ?? null,
    version: sub.version,
  };
}

function deliverableAccessFilter(principal: AuthPrincipal): Prisma.DeliverableWhereInput {
  if (principal.roles.includes('ADMIN')) {
    return {
      assignment: {
        oleada: {
          organizationId: principal.organization.id,
        },
      },
    };
  }

  const scopes: Prisma.DeliverableWhereInput[] = [];

  if (principal.roles.includes('MENTOR')) {
    scopes.push({
      assignment: {
        oleada: {
          organizationId: principal.organization.id,
        },
      },
    });
  }

  if (principal.roles.includes('PARTICIPANT')) {
    scopes.push({
      enrollment: {
        userId: principal.userId,
      },
    });
  }

  return {
    assignment: {
      oleada: {
        organizationId: principal.organization.id,
      },
    },
    ...(scopes.length === 0
      ? {
          id: {
            equals: '00000000-0000-4000-8000-000000000000',
          },
        }
      : {
          OR: scopes,
        }),
  };
}

@Injectable()
export class DeliverablesRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(
    principal: AuthPrincipal,
    page: number,
    limit: number,
    status?: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'EVALUATED' | 'RETURNED',
  ): Promise<DeliverablePage> {
    const skip = (page - 1) * limit;
    const where: Prisma.DeliverableWhereInput = {
      AND: [
        deliverableAccessFilter(principal),
        ...(status === undefined
          ? []
          : [
              {
                submissions: {
                  some: {
                    status,
                  },
                },
              },
            ]),
      ],
    };

    const [deliverables, total] = await this.prisma.$transaction([
      this.prisma.deliverable.findMany({
        include: deliverableInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip,
        take: limit,
        where,
      }),
      this.prisma.deliverable.count({ where }),
    ]);

    return {
      data: deliverables.map(toDeliverableDetailView),
      meta: {
        hasNextPage: skip + deliverables.length < total,
        limit,
        page,
        total,
      },
    };
  }

  async listPendingReviews(
    principal: AuthPrincipal,
    page: number,
    limit: number,
  ): Promise<DeliverablePage> {
    const skip = (page - 1) * limit;
    const where: Prisma.DeliverableWhereInput = {
      AND: [
        deliverableAccessFilter(principal),
        {
          submissions: {
            some: {
              status: {
                in: ['SUBMITTED', 'UNDER_REVIEW'],
              },
            },
          },
        },
      ],
    };

    const [deliverables, total] = await this.prisma.$transaction([
      this.prisma.deliverable.findMany({
        include: deliverableInclude,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip,
        take: limit,
        where,
      }),
      this.prisma.deliverable.count({ where }),
    ]);

    return {
      data: deliverables.map(toDeliverableDetailView),
      meta: {
        hasNextPage: skip + deliverables.length < total,
        limit,
        page,
        total,
      },
    };
  }

  async findById(
    principal: AuthPrincipal,
    deliverableId: string,
  ): Promise<DeliverableDetailView | null> {
    const deliverable = await this.prisma.deliverable.findFirst({
      include: deliverableInclude,
      where: {
        AND: [
          deliverableAccessFilter(principal),
          {
            id: deliverableId,
          },
        ],
      },
    });

    return deliverable === null ? null : toDeliverableDetailView(deliverable);
  }

  async getTopCandidates(
    principal: AuthPrincipal,
    assignmentId: string,
  ): Promise<TopCandidatesView | null> {
    const assignment = await this.prisma.assignment.findFirst({
      include: {
        topCandidates: {
          orderBy: {
            rank: 'asc',
          },
        },
      },
      where: {
        id: assignmentId,
        oleada: {
          organizationId: principal.organization.id,
        },
      },
    });

    if (assignment === null) {
      return null;
    }

    return {
      assignmentId: assignment.id,
      candidates: assignment.topCandidates.map((c) => ({
        rank: c.rank,
        submissionId: c.submissionId,
      })),
      provisionalRule: true,
      version: assignment.version,
    };
  }
}
