import type { ApiComponents } from '@edu-mentor/shared-types';
import { lookupOr } from './lookup';

type Schemas = ApiComponents['schemas'];

export type Session = Schemas['Session'];
export type SessionSummary = Schemas['SessionSummary'];
export type SessionStatus = Schemas['SessionStatus'];
export type SessionType = Schemas['SessionType'];
export type SessionPhase = Schemas['SessionPhase'];
export type SessionParticipant = Schemas['SessionParticipant'];
export type ConfirmationSummary = Schemas['ConfirmationSummary'];

/* -------------------------------------------------- desglose de confirmación */

/**
 * El desglose que ve el mentor: "5 confirmaron · 1 no asistirá · 2 sin
 * responder".
 *
 * No es un "5 de 8" ni un chip agregado. `declined` y `pending` significan
 * cosas distintas para quien organiza —uno avisó, el otro no respondió— y
 * fundirlos en un solo número borra justo la diferencia que decide a quién
 * hay que escribirle.
 *
 * Se omiten los tramos en cero: "0 no asistirá" es ruido.
 */
export function describeConfirmations(summary: ConfirmationSummary): string {
  const parts: string[] = [];

  if (summary.confirmed > 0) {
    parts.push(`${summary.confirmed} confirmaron`);
  }

  if (summary.declined > 0) {
    parts.push(`${summary.declined} no asistirá${summary.declined === 1 ? '' : 'n'}`);
  }

  if (summary.pending > 0) {
    parts.push(`${summary.pending} sin responder`);
  }

  return parts.length === 0 ? 'Sin participantes' : parts.join(' · ');
}

/** Quién no ha respondido todavía: es a quien el mentor debe recordarle. */
export function awaitingResponse(session: Session): readonly SessionParticipant[] {
  return session.participants.filter((participant) => participant.confirmationStatus === 'PENDING');
}

/* ------------------------------------------------------- fase y periodo */

/**
 * `FASE_1` exige `weekNumber`; `FASE_2` exige `checkpointMonth`. Nunca ambos,
 * nunca ninguno (DEC-009).
 *
 * La UI impide el estado imposible, pero **el `CHECK` en DB sigue siendo
 * necesario**: esto es ayuda al formulario, no una capa de validación.
 */
export type PeriodField = 'weekNumber' | 'checkpointMonth';

export function periodFieldFor(phase: SessionPhase): PeriodField {
  return phase === 'FASE_1' ? 'weekNumber' : 'checkpointMonth';
}

/** Semanas del Hub de Empleabilidad. */
export const weekOptions: readonly number[] = [1, 2, 3, 4, 5, 6];

/** Los checkpoints de Fase 2 no son mensuales seguidos: son 1, 2, 3 y 6. */
export const checkpointMonthOptions: readonly number[] = [1, 2, 3, 6];

export function periodOptionsFor(phase: SessionPhase): readonly number[] {
  return phase === 'FASE_1' ? weekOptions : checkpointMonthOptions;
}

export interface PeriodProblem {
  readonly field: PeriodField;
  readonly message: string;
}

/**
 * Valida la coherencia fase/periodo antes de enviar. Devuelve el problema, no
 * un booleano: el formulario necesita decir qué falta.
 */
export function validatePeriod(input: {
  readonly phase: SessionPhase;
  readonly weekNumber: number | null;
  readonly checkpointMonth: number | null;
}): PeriodProblem | null {
  const expected = periodFieldFor(input.phase);
  const value = expected === 'weekNumber' ? input.weekNumber : input.checkpointMonth;
  const other = expected === 'weekNumber' ? input.checkpointMonth : input.weekNumber;

  if (value === null) {
    return {
      field: expected,
      message:
        expected === 'weekNumber'
          ? 'Elige la semana del programa (1 a 6).'
          : 'Elige el mes del checkpoint (1, 2, 3 o 6).',
    };
  }

  if (!periodOptionsFor(input.phase).includes(value)) {
    return { field: expected, message: 'Ese periodo no existe en esta fase.' };
  }

  if (other !== null) {
    return {
      field: expected === 'weekNumber' ? 'checkpointMonth' : 'weekNumber',
      message: 'Una sesión pertenece a una sola fase: deja el otro periodo vacío.',
    };
  }

  return null;
}

/** Etiqueta del periodo, según lo que la sesión traiga poblado. */
export function describePeriod(session: Session): string | null {
  if (typeof session.weekNumber === 'number') {
    return `Semana ${session.weekNumber}`;
  }

  if (typeof session.checkpointMonth === 'number') {
    return `Checkpoint mes ${session.checkpointMonth}`;
  }

  return null;
}

/* ------------------------------------------------ acciones sobre la sesión */

/**
 * Qué puede hacer el mentor con una sesión, según su estado y el reloj.
 *
 * Completar y registrar asistencia solo tienen sentido una vez empezada: antes
 * son botones que confunden. Reprogramar y cancelar exigen que siga
 * `SCHEDULED`, porque el resto de estados son terminales.
 */
export interface SessionActions {
  readonly canEdit: boolean;
  readonly canReschedule: boolean;
  readonly canCancel: boolean;
  readonly canComplete: boolean;
  readonly canRegisterAttendance: boolean;
}

export function actionsFor(session: Session, now: Date): SessionActions {
  const scheduled = session.status === 'SCHEDULED';
  const hasStarted = new Date(session.startsAt).getTime() <= now.getTime();

  return {
    canEdit: scheduled,
    canReschedule: scheduled,
    canCancel: scheduled,
    canComplete: scheduled && hasStarted,
    // La asistencia se registra durante o después, nunca antes.
    canRegisterAttendance: hasStarted && session.status !== 'CANCELLED',
  };
}

/* ------------------------------------------------------------- calendario */

export interface DayGroup {
  /** Clave `YYYY-MM-DD` en la zona horaria de la sesión. */
  readonly day: string;
  readonly sessions: readonly Session[];
}

/**
 * Agrupa por día **en la zona de cada sesión**, no en la del navegador.
 *
 * Una sesión de Lima a las 20:00 UTC es del día 26 allá y del 27 en Madrid.
 * Agrupar por la zona local de quien mira movería sesiones de día según dónde
 * esté abierto el portal.
 */
export function groupByDay(sessions: readonly Session[]): readonly DayGroup[] {
  const groups = new Map<string, Session[]>();

  for (const session of sessions) {
    const day = dayKey(session.startsAt, session.timezone);
    const existing = groups.get(day);

    if (existing === undefined) {
      groups.set(day, [session]);
    } else {
      existing.push(session);
    }
  }

  return [...groups.entries()]
    .map(([day, items]) => ({
      day,
      sessions: [...items].sort((left, right) => left.startsAt.localeCompare(right.startsAt)),
    }))
    .sort((left, right) => left.day.localeCompare(right.day));
}

export function dayKey(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

/* ---------------------------------------------------------- asistencia */

export interface AttendanceBreakdown {
  readonly attended: number;
  readonly absent: number;
  readonly unregistered: number;
  readonly total: number;
  readonly isComplete: boolean;
}

/**
 * Cuántas asistencias faltan por registrar.
 *
 * `attendanceStatus: PENDING` significa **sin registrar**, no "ausente". Un
 * mentor que aún no pasó lista no está diciendo que nadie vino, y tratarlo como
 * falta convertiría un olvido en un dato del programa.
 */
export function attendanceBreakdown(session: Session): AttendanceBreakdown {
  const attended = session.participants.filter(
    (item) => item.attendanceStatus === 'ATTENDED',
  ).length;
  const absent = session.participants.filter((item) => item.attendanceStatus === 'ABSENT').length;
  const total = session.participants.length;
  const unregistered = total - attended - absent;

  return { attended, absent, unregistered, total, isComplete: unregistered === 0 && total > 0 };
}

export function describeAttendance(breakdown: AttendanceBreakdown): string {
  if (breakdown.total === 0) {
    return 'Sin participantes';
  }

  if (breakdown.unregistered === breakdown.total) {
    return 'Asistencia sin registrar';
  }

  const parts = [`${breakdown.attended} asistieron`];

  if (breakdown.absent > 0) {
    parts.push(`${breakdown.absent} no asistió${breakdown.absent === 1 ? '' : 'ieron'}`);
  }

  if (breakdown.unregistered > 0) {
    parts.push(`${breakdown.unregistered} sin registrar`);
  }

  return parts.join(' · ');
}

/* ------------------------------------------- reprogramación y trazabilidad */

export type RescheduleRequest = Schemas['RescheduleRequest'];
export type RescheduleRequestStatus = Schemas['RescheduleRequestStatus'];

/**
 * Una solicitud solo se decide mientras está `PENDING`. El resto de estados son
 * terminales y la UI no debe ofrecer botones que el backend rechazaría.
 */
export function canDecideRequest(request: RescheduleRequest): boolean {
  return request.status === 'PENDING';
}

/**
 * **Mientras la solicitud está pendiente, la sesión sigue programada.**
 *
 * Es la invariante más delicada del módulo (`12-domain-state-machines.md` §3):
 * si la UI insinúa que la sesión ya se movió, alguien falta a una sesión que
 * sigue en pie.
 */
export function sessionStillStands(request: RescheduleRequest): boolean {
  return request.status === 'PENDING';
}

/** Una sesión reemplazada por otra: ya no es la vigente. */
export function isSuperseded(session: Session): boolean {
  return session.status === 'RESCHEDULED';
}

/** Nació como reemplazo de otra sesión; permite mostrar el encadenamiento. */
export function replacedAnother(session: Session): boolean {
  return (session.rescheduledFromId ?? null) !== null;
}

/* --------------------------------------------------- tipo de sesión y orden */

/**
 * Orden de la agenda: primero lo que sigue abierto, luego lo terminal. A igual
 * estado, cronológico — que en una agenda es lo natural.
 */
const statusPriority: Record<SessionStatus, number> = {
  SCHEDULED: 0,
  COMPLETED: 1,
  RESCHEDULED: 2,
  CANCELLED: 3,
};

export function sortForAgenda(sessions: readonly Session[]): readonly Session[] {
  return [...sessions].sort((left, right) => {
    const byStatus =
      lookupOr(statusPriority, left.status, Number.MAX_SAFE_INTEGER) -
      lookupOr(statusPriority, right.status, Number.MAX_SAFE_INTEGER);

    if (byStatus !== 0) {
      return byStatus;
    }

    return left.startsAt.localeCompare(right.startsAt);
  });
}
