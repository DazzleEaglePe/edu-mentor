import type { MentorCapabilityKind, RoleKey } from '../../generated/prisma/enums.js';

export interface AuthPrincipal {
  readonly activeEnrollment: {
    readonly currentPhase: 'FASE_0' | 'FASE_1' | 'FASE_2' | 'FINISHED';
    readonly currentWeek: number | null;
    readonly id: string;
    readonly oleada: {
      readonly id: string;
      readonly name: string;
    };
  } | null;
  readonly email: string;
  readonly fullName: string;
  readonly mentorCapabilities: readonly MentorCapabilityKind[];
  readonly mustChangePassword: boolean;
  readonly organization: {
    readonly id: string;
    readonly name: string;
  };
  readonly roles: readonly RoleKey[];
  readonly sessionId: string;
  readonly userId: string;
}
