import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { AuthMe, Deliverable, Session } from '@edu-mentor/shared-types';
import type { AdminUserPage } from '@/lib/domain/users';
import type { Enrollment, MentorAssignment, Oleada } from '@/lib/domain/cohorts';
import type { RescheduleRequest } from '@/lib/domain/agenda';

/**
 * Fuente de datos **provisional** mientras la API no expone auth ni sesiones.
 *
 * Lee los fixtures sintéticos que publicó Codex en `docs/api/fixtures/`. Son la
 * fuente única: el diseño no mantiene una copia propia para no crear una
 * segunda verdad.
 *
 * Este módulo desaparece cuando exista el primer vertical slice de auth; hasta
 * entonces, ninguna pantalla debe simular una respuesta que el contrato no
 * describa.
 */

async function readFixture<T>(name: string): Promise<T> {
  const path = resolve(process.cwd(), '../../docs/api/fixtures', name);
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw) as T;
}

export function loadAuthMe(): Promise<AuthMe> {
  return readFixture<AuthMe>('auth-me.participant.json');
}

/**
 * Identidad de mentor, **solo para las pantallas del mentor**.
 *
 * Existe porque el shell resuelve la navegación desde `roles[]`: con la
 * identidad de participante, `/agenda` mostraba "Mis entregables" en el
 * sidebar. No sustituye a `loadAuthMe`; cuando exista auth real, ambas
 * desaparecen y la identidad viene de la sesión.
 */
export function loadMentorAuthMe(): Promise<AuthMe> {
  return readFixture<AuthMe>('auth-me.mentor.json');
}

/** Identidad de admin, **solo para las pantallas administrativas**. */
export function loadAdminAuthMe(): Promise<AuthMe> {
  return readFixture<AuthMe>('auth-me.admin.json');
}

export function loadSessionDetail(): Promise<Session> {
  return readFixture<Session>('session.detail.json');
}

export function loadGroupSession(): Promise<Session> {
  return readFixture<Session>('session.group.json');
}

export function loadRescheduledSession(): Promise<Session> {
  return readFixture<Session>('session.rescheduled.json');
}

export function loadRescheduleRequest(): Promise<RescheduleRequest> {
  return readFixture<RescheduleRequest>('reschedule-request.json');
}

export function loadDeliverableDetail(): Promise<Deliverable> {
  return readFixture<Deliverable>('deliverable.detail.json');
}

export function loadEvaluatedDeliverable(): Promise<Deliverable> {
  return readFixture<Deliverable>('deliverable.evaluated.json');
}

export function loadAdminUsers(): Promise<AdminUserPage> {
  return readFixture<AdminUserPage>('admin.users-page.json');
}

export function loadAdminOleada(): Promise<Oleada> {
  return readFixture<Oleada>('admin.oleada.json');
}

export function loadAdminEnrollment(): Promise<Enrollment> {
  return readFixture<Enrollment>('admin.enrollment.json');
}

export function loadAdminMentorAssignment(): Promise<MentorAssignment> {
  return readFixture<MentorAssignment>('admin.mentor-assignment.json');
}
