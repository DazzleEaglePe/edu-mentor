import type { ApiComponents } from '@edu-mentor/shared-types';
import { lookupOr } from './lookup';

type Schemas = ApiComponents['schemas'];

export type Oleada = Schemas['Oleada'];
export type OleadaStatus = Schemas['OleadaStatus'];
export type Enrollment = Schemas['Enrollment'];
export type EnrollmentStatus = Schemas['EnrollmentStatus'];
export type MentorAssignment = Schemas['MentorAssignment'];
export type MentorAssignmentStatus = Schemas['MentorAssignmentStatus'];

/* ------------------------------------------------------------------ oleadas */

/**
 * Ocupación de la oleada.
 *
 * `activeEnrollmentCount` viene del contrato, así que la pantalla no necesita
 * pedir la lista de enrollments para decir "18 de 30". `remaining` nunca es
 * negativo: si el backend reportara más inscritos que cupos, mostrar "-2
 * disponibles" confundiría más que un cero honesto.
 */
export interface Occupancy {
  readonly used: number;
  readonly capacity: number;
  readonly remaining: number;
  readonly isFull: boolean;
  readonly percentage: number;
}

export function occupancyOf(oleada: Oleada): Occupancy {
  const used = oleada.activeEnrollmentCount;
  const capacity = oleada.capacity;
  const remaining = Math.max(0, capacity - used);

  return {
    used,
    capacity,
    remaining,
    isFull: used >= capacity,
    percentage: capacity === 0 ? 0 : Math.round((used / capacity) * 100),
  };
}

/**
 * Una oleada cerrada es de solo lectura.
 *
 * La UI oculta las acciones, pero el backend lo valida igual: esto es cortesía
 * para no ofrecer un botón que siempre fallaría, no una regla de seguridad.
 */
export function isReadOnly(oleada: Oleada): boolean {
  return oleada.status === 'CLOSED';
}

/**
 * Transiciones válidas de la oleada, según `DRAFT → OPEN → IN_PROGRESS →
 * CLOSED`. No hay vuelta atrás: reabrir una oleada cerrada no es una edición,
 * sería otra decisión de programa.
 */
const nextStatuses: Record<OleadaStatus, readonly OleadaStatus[]> = {
  DRAFT: ['OPEN'],
  OPEN: ['IN_PROGRESS', 'CLOSED'],
  IN_PROGRESS: ['CLOSED'],
  CLOSED: [],
};

export function allowedTransitions(status: OleadaStatus): readonly OleadaStatus[] {
  // El argumento de tipo es explícito porque `[]` se infiere como `never[]` y
  // no reconcilia con `readonly OleadaStatus[]`.
  return lookupOr<readonly OleadaStatus[]>(nextStatuses, status, []);
}

export function canTransition(from: OleadaStatus, to: OleadaStatus): boolean {
  return allowedTransitions(from).includes(to);
}

/* ------------------------------------------------------- setup de la oleada */

/**
 * Los cuatro pasos del setup guiado (A6 + A7 + A8).
 *
 * Se derivan del estado real, no de un checklist manual: si alguien inscribe
 * gente por otra vía, el paso se marca solo. Un stepper que hay que actualizar
 * a mano miente en cuanto alguien trabaja fuera de él.
 */
export interface SetupStep {
  readonly id: 'oleada' | 'usuarios' | 'inscripciones' | 'asignaciones';
  readonly label: string;
  readonly done: boolean;
  readonly detail: string;
}

export interface SetupInput {
  readonly oleada: Oleada;
  readonly userCount: number;
  readonly enrollments: readonly Enrollment[];
  readonly assignments: readonly MentorAssignment[];
}

export function setupSteps(input: SetupInput): readonly SetupStep[] {
  const { oleada, userCount, enrollments, assignments } = input;
  const occupancy = occupancyOf(oleada);
  const active = enrollments.filter((item) => item.status === 'ACTIVE');
  const covered = coveredEnrollmentIds(assignments, active);

  return [
    {
      id: 'oleada',
      label: 'Datos de la oleada',
      done: true,
      detail: `${oleada.sector} · cupo ${oleada.capacity}`,
    },
    {
      id: 'usuarios',
      label: 'Usuarios',
      done: userCount > 0,
      detail: `${userCount} en la organización`,
    },
    {
      id: 'inscripciones',
      label: 'Inscripciones',
      done: occupancy.used > 0,
      detail: `${occupancy.used} de ${occupancy.capacity} cupos`,
    },
    {
      id: 'asignaciones',
      label: 'Asignaciones',
      done: active.length > 0 && covered.size === active.length,
      detail: `${covered.size} de ${active.length} con mentor`,
    },
  ];
}

/* --------------------------------------------------- asignaciones de mentor */

/**
 * `enrollmentId` es **nullable**: una asignación vigente puede cubrir la oleada
 * completa —el mentor de los talleres grupales— o a un participante concreto.
 * Asumir 1:1 dejaría fuera el caso que el contrato modela explícitamente.
 */
export type AssignmentScope = 'OLEADA' | 'PARTICIPANT';

export function scopeOf(assignment: MentorAssignment): AssignmentScope {
  const enrollmentId = assignment.enrollmentId ?? null;
  return enrollmentId === null ? 'OLEADA' : 'PARTICIPANT';
}

export function isActiveAssignment(assignment: MentorAssignment): boolean {
  return assignment.status === 'ACTIVE';
}

/**
 * Qué participantes tienen mentor vigente.
 *
 * Una asignación de alcance `OLEADA` cubre a todos los inscritos activos: no
 * contarla dejaría a la pantalla pidiendo asignaciones individuales que el
 * programa no necesita.
 */
export function coveredEnrollmentIds(
  assignments: readonly MentorAssignment[],
  enrollments: readonly Enrollment[],
): ReadonlySet<string> {
  const active = assignments.filter(isActiveAssignment);
  const coversWholeOleada = active.some((item) => scopeOf(item) === 'OLEADA');

  if (coversWholeOleada) {
    return new Set(enrollments.map((item) => item.id));
  }

  const covered = new Set<string>();
  for (const assignment of active) {
    const enrollmentId = assignment.enrollmentId ?? null;
    if (enrollmentId !== null) {
      covered.add(enrollmentId);
    }
  }

  return covered;
}

/** Periodo de vigencia legible. `endsAt` nulo significa "sigue vigente". */
export function assignmentPeriod(
  assignment: MentorAssignment,
  formatDay: (iso: string) => string,
): string {
  const endsAt = assignment.endsAt ?? null;
  const start = formatDay(assignment.startsAt);

  return endsAt === null ? `desde ${start}` : `${start} – ${formatDay(endsAt)}`;
}
