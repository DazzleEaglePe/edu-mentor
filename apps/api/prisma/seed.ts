import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

import { PrismaClient } from '../src/generated/prisma/client.js';
import {
  SYNTHETIC_DEMO_PASSWORD,
  SYNTHETIC_EMAILS,
  SYNTHETIC_IDS,
} from '../src/integration/support/synthetic-seed-data.js';
import { PasswordHasher } from '../src/modules/auth/crypto/password-hasher.js';

interface SyntheticUser {
  readonly email: string;
  readonly fullName: string;
  readonly id: string;
  readonly organizationId: string;
  readonly roleKey: 'ADMIN' | 'MENTOR' | 'PARTICIPANT';
}

const USERS: readonly SyntheticUser[] = [
  {
    email: SYNTHETIC_EMAILS.participant,
    fullName: 'Participante Demo',
    id: SYNTHETIC_IDS.participantUser,
    organizationId: SYNTHETIC_IDS.organization,
    roleKey: 'PARTICIPANT',
  },
  {
    email: SYNTHETIC_EMAILS.mentor,
    fullName: 'Mentora Demo',
    id: SYNTHETIC_IDS.mentorUser,
    organizationId: SYNTHETIC_IDS.organization,
    roleKey: 'MENTOR',
  },
  {
    email: SYNTHETIC_EMAILS.admin,
    fullName: 'Administradora Demo',
    id: SYNTHETIC_IDS.adminUser,
    organizationId: SYNTHETIC_IDS.organization,
    roleKey: 'ADMIN',
  },
  {
    email: SYNTHETIC_EMAILS.externalParticipant,
    fullName: 'Participante Externa Demo',
    id: SYNTHETIC_IDS.externalParticipantUser,
    organizationId: SYNTHETIC_IDS.externalOrganization,
    roleKey: 'PARTICIPANT',
  },
];

async function run(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Synthetic seed is disabled in production.');
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl === undefined) {
    throw new Error('DATABASE_URL is required to run the synthetic seed.');
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 2_000,
    max: 2,
  });
  const prisma = new PrismaClient({
    adapter: new PrismaPg(pool),
  });

  try {
    const passwordHasher = new PasswordHasher();
    const passwordHashes = await Promise.all(
      USERS.map(() => passwordHasher.hash(SYNTHETIC_DEMO_PASSWORD)),
    );

    await prisma.$transaction(async (transaction) => {
      const roleIds = new Map<SyntheticUser['roleKey'], string>();

      for (const role of [
        {
          id: SYNTHETIC_IDS.participantRole,
          key: 'PARTICIPANT' as const,
          name: 'Participante',
        },
        {
          id: SYNTHETIC_IDS.mentorRole,
          key: 'MENTOR' as const,
          name: 'Mentor',
        },
        {
          id: SYNTHETIC_IDS.adminRole,
          key: 'ADMIN' as const,
          name: 'Administrador',
        },
      ]) {
        const storedRole = await transaction.role.upsert({
          create: role,
          update: {
            name: role.name,
          },
          where: {
            key: role.key,
          },
        });
        roleIds.set(role.key, storedRole.id);
      }

      await transaction.organization.upsert({
        create: {
          id: SYNTHETIC_IDS.organization,
          name: 'EDU-US Demo',
          slug: 'edu-us-demo',
        },
        update: {
          name: 'EDU-US Demo',
          status: 'ACTIVE',
        },
        where: {
          id: SYNTHETIC_IDS.organization,
        },
      });
      await transaction.organization.upsert({
        create: {
          id: SYNTHETIC_IDS.externalOrganization,
          name: 'Organización Externa Demo',
          slug: 'organizacion-externa-demo',
        },
        update: {
          name: 'Organización Externa Demo',
          status: 'ACTIVE',
        },
        where: {
          id: SYNTHETIC_IDS.externalOrganization,
        },
      });

      for (const [index, user] of USERS.entries()) {
        const passwordHash = passwordHashes[index];

        if (passwordHash === undefined) {
          throw new Error('Synthetic password hash was not generated.');
        }

        await transaction.user.upsert({
          create: {
            email: user.email,
            fullName: user.fullName,
            id: user.id,
            isActive: true,
            mustChangePassword: false,
            normalizedEmail: user.email,
            organizationId: user.organizationId,
            passwordHash,
            version: 1,
          },
          update: {
            email: user.email,
            fullName: user.fullName,
            isActive: true,
            mustChangePassword: false,
            normalizedEmail: user.email,
            organizationId: user.organizationId,
            passwordHash,
            version: 1,
          },
          where: {
            id: user.id,
          },
        });
      }

      await transaction.authSession.updateMany({
        data: {
          revokedAt: new Date(),
        },
        where: {
          revokedAt: null,
          userId: {
            in: USERS.map((user) => user.id),
          },
        },
      });
      await transaction.userRole.deleteMany({
        where: {
          userId: {
            in: USERS.map((user) => user.id),
          },
        },
      });
      await transaction.userRole.createMany({
        data: USERS.map((user) => {
          const roleId = roleIds.get(user.roleKey);

          if (roleId === undefined) {
            throw new Error('Synthetic role reference was not generated.');
          }

          return {
            assignedByUserId:
              user.organizationId === SYNTHETIC_IDS.organization ? SYNTHETIC_IDS.adminUser : null,
            roleId,
            userId: user.id,
          };
        }),
      });

      await transaction.mentorProfile.upsert({
        create: {
          bio: 'Perfil sintético para pruebas locales.',
          headline: 'Mentoría de empleabilidad',
          userId: SYNTHETIC_IDS.mentorUser,
        },
        update: {
          bio: 'Perfil sintético para pruebas locales.',
          headline: 'Mentoría de empleabilidad',
        },
        where: {
          userId: SYNTHETIC_IDS.mentorUser,
        },
      });
      await transaction.mentorCapability.deleteMany({
        where: {
          mentorProfileId: SYNTHETIC_IDS.mentorUser,
        },
      });
      await transaction.mentorCapability.createMany({
        data: [
          {
            kind: 'SPECIALIST',
            mentorProfileId: SYNTHETIC_IDS.mentorUser,
          },
          {
            kind: 'PEER',
            mentorProfileId: SYNTHETIC_IDS.mentorUser,
          },
        ],
      });

      await transaction.oleada.upsert({
        create: {
          capacity: 30,
          endDate: new Date('2027-02-28T00:00:00.000Z'),
          id: SYNTHETIC_IDS.oleada,
          name: 'Oleada Tecnología Demo 2026',
          organizationId: SYNTHETIC_IDS.organization,
          sector: 'Tecnología',
          startDate: new Date('2026-08-01T00:00:00.000Z'),
          status: 'OPEN',
          version: 2,
        },
        update: {
          capacity: 30,
          endDate: new Date('2027-02-28T00:00:00.000Z'),
          name: 'Oleada Tecnología Demo 2026',
          organizationId: SYNTHETIC_IDS.organization,
          sector: 'Tecnología',
          startDate: new Date('2026-08-01T00:00:00.000Z'),
          status: 'OPEN',
          version: 2,
        },
        where: {
          id: SYNTHETIC_IDS.oleada,
        },
      });
      await transaction.enrollment.upsert({
        create: {
          currentPhase: 'FASE_1',
          currentWeek: 4,
          enrolledAt: new Date('2026-08-01T14:00:00.000Z'),
          id: SYNTHETIC_IDS.enrollment,
          oleadaId: SYNTHETIC_IDS.oleada,
          status: 'ACTIVE',
          userId: SYNTHETIC_IDS.participantUser,
          version: 3,
        },
        update: {
          currentPhase: 'FASE_1',
          currentWeek: 4,
          enrolledAt: new Date('2026-08-01T14:00:00.000Z'),
          oleadaId: SYNTHETIC_IDS.oleada,
          phase1GraduatedAt: null,
          status: 'ACTIVE',
          userId: SYNTHETIC_IDS.participantUser,
          version: 3,
        },
        where: {
          id: SYNTHETIC_IDS.enrollment,
        },
      });
      await transaction.mentorAssignment.upsert({
        create: {
          capability: 'SPECIALIST',
          enrollmentId: null,
          id: SYNTHETIC_IDS.mentorAssignment,
          mentorUserId: SYNTHETIC_IDS.mentorUser,
          oleadaId: SYNTHETIC_IDS.oleada,
          startsAt: new Date('2026-08-01T14:00:00.000Z'),
          version: 1,
        },
        update: {
          capability: 'SPECIALIST',
          endsAt: null,
          enrollmentId: null,
          mentorUserId: SYNTHETIC_IDS.mentorUser,
          oleadaId: SYNTHETIC_IDS.oleada,
          startsAt: new Date('2026-08-01T14:00:00.000Z'),
          version: 1,
        },
        where: {
          id: SYNTHETIC_IDS.mentorAssignment,
        },
      });
      await transaction.session.upsert({
        create: {
          confirmationClosesAt: new Date('2026-08-12T20:00:00.000Z'),
          createdByUserId: SYNTHETIC_IDS.adminUser,
          description: 'Sesión sintética para validar el contrato.',
          endsAt: new Date('2026-08-12T20:45:00.000Z'),
          id: SYNTHETIC_IDS.session,
          meetingUrl: 'https://meet.example.test/demo-session',
          mentorUserId: SYNTHETIC_IDS.mentorUser,
          oleadaId: SYNTHETIC_IDS.oleada,
          phase: 'FASE_1',
          startsAt: new Date('2026-08-12T20:00:00.000Z'),
          status: 'SCHEDULED',
          timezone: 'America/Lima',
          title: 'Mentoría 1:1 — Objetivo profesional',
          type: 'ONE_ON_ONE',
          version: 3,
          weekNumber: 4,
        },
        update: {
          checkpointMonth: null,
          confirmationClosesAt: new Date('2026-08-12T20:00:00.000Z'),
          createdByUserId: SYNTHETIC_IDS.adminUser,
          description: 'Sesión sintética para validar el contrato.',
          endsAt: new Date('2026-08-12T20:45:00.000Z'),
          meetingUrl: 'https://meet.example.test/demo-session',
          mentorUserId: SYNTHETIC_IDS.mentorUser,
          oleadaId: SYNTHETIC_IDS.oleada,
          phase: 'FASE_1',
          rescheduleReason: null,
          rescheduledFromId: null,
          startsAt: new Date('2026-08-12T20:00:00.000Z'),
          status: 'SCHEDULED',
          timezone: 'America/Lima',
          title: 'Mentoría 1:1 — Objetivo profesional',
          type: 'ONE_ON_ONE',
          version: 3,
          weekNumber: 4,
        },
        where: {
          id: SYNTHETIC_IDS.session,
        },
      });
      await transaction.sessionParticipant.upsert({
        create: {
          attendanceStatus: 'PENDING',
          confirmationStatus: 'CONFIRMED',
          confirmedAt: new Date('2026-08-10T15:30:00.000Z'),
          enrollmentId: SYNTHETIC_IDS.enrollment,
          sessionId: SYNTHETIC_IDS.session,
          version: 2,
        },
        update: {
          attendanceRecordedAt: null,
          attendanceRecordedById: null,
          attendanceStatus: 'PENDING',
          confirmationStatus: 'CONFIRMED',
          confirmedAt: new Date('2026-08-10T15:30:00.000Z'),
          version: 2,
        },
        where: {
          sessionId_enrollmentId: {
            enrollmentId: SYNTHETIC_IDS.enrollment,
            sessionId: SYNTHETIC_IDS.session,
          },
        },
      });
      await transaction.scheduleReservation.deleteMany({
        where: {
          sessionId: SYNTHETIC_IDS.session,
        },
      });
      await transaction.scheduleReservation.createMany({
        data: [
          {
            endsAt: new Date('2026-08-12T20:45:00.000Z'),
            id: SYNTHETIC_IDS.mentorReservation,
            resourceId: SYNTHETIC_IDS.mentorUser,
            resourceType: 'USER',
            sessionId: SYNTHETIC_IDS.session,
            startsAt: new Date('2026-08-12T20:00:00.000Z'),
          },
          {
            endsAt: new Date('2026-08-12T20:45:00.000Z'),
            id: SYNTHETIC_IDS.participantReservation,
            resourceId: SYNTHETIC_IDS.enrollment,
            resourceType: 'ENROLLMENT',
            sessionId: SYNTHETIC_IDS.session,
            startsAt: new Date('2026-08-12T20:00:00.000Z'),
          },
        ],
      });
    });

    console.log('synthetic_seed=ok organizations=2 users=4 roles=3 sessions=1');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

void run().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      errorName: error instanceof Error ? error.name : 'UnknownError',
      event: 'synthetic_seed_failed',
    }),
  );
  process.exitCode = 1;
});
