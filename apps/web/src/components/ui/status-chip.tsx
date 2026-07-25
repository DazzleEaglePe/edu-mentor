import {
  translateStatus,
  type AttendanceStatus,
  type ConfirmationStatus,
  type RescheduleRequestStatus,
  type ScanStatus,
  type SessionStatus,
  type StatusKind,
  type StatusTone,
  type SubmissionStatus,
} from '@/lib/domain/labels';

/**
 * Chip de estado.
 *
 * Recibe **el enum crudo**, no un color ni una etiqueta. Dos reglas del diseño
 * viven aquí y no deben moverse a quien lo consume:
 *
 * 1. El estado se codifica con **glifo + texto**, nunca solo con color
 *    (WCAG 1.4.1). El glifo es decorativo; el texto es el portador real.
 * 2. Un enum desconocido **falla visible**: significa que el contrato y la UI
 *    se desincronizaron, y esconderlo convierte un bug de contrato en un chip
 *    en blanco que nadie investiga.
 */

const glyphByTone: Record<StatusTone, string> = {
  confirmed: '✓',
  pending: '○',
  review: '◐',
  returned: '↩',
  declined: '✕',
  neutral: '◇',
  inactive: '—',
};

const classByTone: Record<StatusTone, string> = {
  confirmed: 'bg-[var(--edu-status-confirmed-bg)] text-[var(--edu-status-confirmed-text)]',
  pending: 'bg-[var(--edu-status-pending-bg)] text-[var(--edu-status-pending-text)]',
  review: 'bg-[var(--edu-status-review-bg)] text-[var(--edu-status-review-text)]',
  returned: 'bg-[var(--edu-status-returned-bg)] text-[var(--edu-status-returned-text)]',
  declined: 'bg-[var(--edu-status-declined-bg)] text-[var(--edu-status-declined-text)]',
  neutral: 'bg-[var(--edu-status-neutral-bg)] text-[var(--edu-status-neutral-text)]',
  inactive: 'bg-[var(--edu-status-inactive-bg)] text-[var(--edu-status-inactive-text)]',
};

type StatusValueByKind = {
  readonly sessionStatus: SessionStatus;
  readonly confirmationStatus: ConfirmationStatus;
  readonly attendanceStatus: AttendanceStatus;
  readonly submissionStatus: SubmissionStatus;
  readonly rescheduleRequestStatus: RescheduleRequestStatus;
  readonly scanStatus: ScanStatus;
};

export type StatusChipProps = {
  readonly [Kind in StatusKind]: {
    readonly kind: Kind;
    readonly value: StatusValueByKind[Kind];
    /** Prefijo que aclara de qué eje habla el chip, p. ej. "Tu asistencia". */
    readonly prefix?: string;
  };
}[StatusKind];

export function StatusChip({ kind, value, prefix }: StatusChipProps) {
  const status = translateStatus(kind, value);

  if (status === null) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[var(--edu-coral-700)] px-2.5 py-1 text-xs font-semibold text-[var(--edu-coral-800)]"
        title={`Estado no reconocido por la interfaz: ${value}`}
      >
        <span aria-hidden="true">⚠</span>
        Estado desconocido
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${classByTone[status.tone]}`}
    >
      <span aria-hidden="true" className="font-mono text-[0.7rem]">
        {glyphByTone[status.tone]}
      </span>
      {prefix === undefined ? status.label : `${prefix}: ${status.label}`}
    </span>
  );
}
