import type { ApiComponents } from '@edu-mentor/shared-types';
import { lookup } from './lookup';

/**
 * Traductor único de enums del dominio a etiquetas visibles.
 *
 * Regla de `docs/design/00-inventario-pantallas.md` §6: la UI nunca inventa un
 * estado y ningún componente escribe una etiqueta a mano. Si el backend agrega
 * un valor que aquí no existe, `translate` devuelve `null` y el componente que
 * lo consume debe fallar visible — nunca pintar un chip vacío.
 */

type Schemas = ApiComponents['schemas'];

export type SessionStatus = Schemas['SessionStatus'];
export type ConfirmationStatus = Schemas['ConfirmationStatus'];
export type AttendanceStatus = Schemas['AttendanceStatus'];
export type SubmissionStatus = Schemas['SubmissionStatus'];
export type RescheduleRequestStatus = Schemas['RescheduleRequestStatus'];
export type ScanStatus = Schemas['ScanStatus'];
export type SessionType = Schemas['SessionType'];
export type ProgramPhase = Schemas['ProgramPhase'];
export type Role = Schemas['Role'];
export type OleadaStatus = Schemas['OleadaStatus'];
export type EnrollmentStatus = Schemas['EnrollmentStatus'];
export type MentorAssignmentStatus = Schemas['MentorAssignmentStatus'];

/**
 * Tono visual del estado. Deliberadamente NO es un color: el color lo resuelve
 * el token (`--edu-status-*`). Cada tono lleva además un glifo y texto, porque
 * el color nunca puede ser el único portador de significado (WCAG 1.4.1).
 */
export type StatusTone =
  'confirmed' | 'pending' | 'review' | 'returned' | 'declined' | 'neutral' | 'inactive';

export interface StatusLabel {
  readonly label: string;
  readonly tone: StatusTone;
}

const sessionStatus: Record<SessionStatus, StatusLabel> = {
  SCHEDULED: { label: 'Programada', tone: 'neutral' },
  COMPLETED: { label: 'Realizada', tone: 'inactive' },
  CANCELLED: { label: 'Cancelada', tone: 'inactive' },
  RESCHEDULED: { label: 'Reprogramada', tone: 'inactive' },
};

const confirmationStatus: Record<ConfirmationStatus, StatusLabel> = {
  PENDING: { label: 'Por confirmar', tone: 'pending' },
  CONFIRMED: { label: 'Confirmada', tone: 'confirmed' },
  DECLINED: { label: 'No asistiré', tone: 'declined' },
};

const attendanceStatus: Record<AttendanceStatus, StatusLabel> = {
  PENDING: { label: 'Sin registrar', tone: 'neutral' },
  ATTENDED: { label: 'Asistió', tone: 'confirmed' },
  ABSENT: { label: 'No asistió', tone: 'declined' },
};

const submissionStatus: Record<SubmissionStatus, StatusLabel> = {
  DRAFT: { label: 'Borrador', tone: 'neutral' },
  SUBMITTED: { label: 'Enviado', tone: 'pending' },
  UNDER_REVIEW: { label: 'En evaluación', tone: 'review' },
  EVALUATED: { label: 'Evaluado', tone: 'confirmed' },
  RETURNED: { label: 'Devuelto', tone: 'returned' },
};

const rescheduleRequestStatus: Record<RescheduleRequestStatus, StatusLabel> = {
  PENDING: { label: 'Pendiente', tone: 'pending' },
  APPROVED: { label: 'Aprobada', tone: 'confirmed' },
  REJECTED: { label: 'Rechazada', tone: 'declined' },
  CANCELLED: { label: 'Cancelada', tone: 'inactive' },
};

const scanStatus: Record<ScanStatus, StatusLabel> = {
  PENDING: { label: 'Analizando', tone: 'pending' },
  CLEAN: { label: 'Listo', tone: 'confirmed' },
  REJECTED: { label: 'Bloqueado', tone: 'declined' },
  ERROR: { label: 'No se pudo analizar', tone: 'declined' },
};

const oleadaStatus: Record<OleadaStatus, StatusLabel> = {
  DRAFT: { label: 'Borrador', tone: 'neutral' },
  OPEN: { label: 'Convocatoria', tone: 'pending' },
  IN_PROGRESS: { label: 'En curso', tone: 'confirmed' },
  CLOSED: { label: 'Cerrada', tone: 'inactive' },
};

const enrollmentStatus: Record<EnrollmentStatus, StatusLabel> = {
  ACTIVE: { label: 'Activo', tone: 'confirmed' },
  WITHDRAWN: { label: 'Retirado', tone: 'declined' },
  COMPLETED: { label: 'Completado', tone: 'inactive' },
};

const mentorAssignmentStatus: Record<MentorAssignmentStatus, StatusLabel> = {
  ACTIVE: { label: 'Vigente', tone: 'confirmed' },
  CLOSED: { label: 'Cerrada', tone: 'inactive' },
};

const sessionType: Record<SessionType, string> = {
  ONE_ON_ONE: '1:1',
  GROUP: 'Grupal',
  CHECKPOINT: 'Checkpoint',
};

const programPhase: Record<ProgramPhase, string> = {
  FASE_0: 'Fase 0 · Selección',
  FASE_1: 'Fase 1 · Hub de Empleabilidad',
  FASE_2: 'Fase 2 · Acompañamiento',
  FINISHED: 'Programa finalizado',
};

const role: Record<Role, string> = {
  PARTICIPANT: 'Participante',
  MENTOR: 'Mentor',
  ADMIN: 'Admin',
};

const statusDictionaries = {
  sessionStatus,
  confirmationStatus,
  attendanceStatus,
  submissionStatus,
  rescheduleRequestStatus,
  scanStatus,
  oleadaStatus,
  enrollmentStatus,
  mentorAssignmentStatus,
} as const;

export type StatusKind = keyof typeof statusDictionaries;

/**
 * Devuelve `null` cuando el valor no está en el diccionario. Quien lo consume
 * decide qué hacer, pero nunca debe renderizar un estado en blanco: un enum
 * desconocido es un contrato desincronizado y tiene que notarse.
 *
 * La búsqueda pasa por `lookup` para no repetir aquí la protección contra
 * claves heredadas de `Object.prototype` — ver `lookup.ts`.
 */
export function translateStatus(kind: StatusKind, value: string): StatusLabel | null {
  const dictionary: Record<string, StatusLabel> = statusDictionaries[kind];
  return lookup(dictionary, value);
}

export function translateSessionType(value: SessionType): string {
  return sessionType[value];
}

export function translateProgramPhase(value: ProgramPhase): string {
  return programPhase[value];
}

export function translateRole(value: Role): string {
  return role[value];
}

/**
 * Rol principal para el saludo y el badge del topbar.
 * Una persona puede tener varios roles (DEC-002); mostramos el de mayor
 * alcance operativo, sin ocultar que los demás existen.
 */
export function primaryRole(roles: readonly Role[]): Role {
  if (roles.includes('ADMIN')) return 'ADMIN';
  if (roles.includes('MENTOR')) return 'MENTOR';
  return 'PARTICIPANT';
}
