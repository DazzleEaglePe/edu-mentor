/**
 * Fechas y horas.
 *
 * El contrato entrega ISO 8601 con offset y una `timezone` propia por sesión.
 * La UI formatea **en esa zona** y la muestra cuando puede haber ambigüedad:
 * "vence el 1 de junio" sin zona horaria genera reclamos.
 */

const dateTimeFormatter = (timezone: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('es-PE', { timeZone: timezone, ...options });

export function formatDateTime(iso: string, timezone: string): string {
  return dateTimeFormatter(timezone, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatDate(iso: string, timezone: string): string {
  return dateTimeFormatter(timezone, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));
}

export function formatTime(iso: string, timezone: string): string {
  return dateTimeFormatter(timezone, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

/** "10:00–11:00 del mar 19 ago (Lima)" — el texto que usa el banner de conflicto. */
export function formatInterval(startsAt: string, endsAt: string, timezone: string): string {
  const day = dateTimeFormatter(timezone, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(startsAt));

  return `de ${formatTime(startsAt, timezone)} a ${formatTime(endsAt, timezone)} el ${day}`;
}

/** En una cola de trabajo importa cuánto lleva esperando, no la fecha exacta. */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const diffMs = new Date(iso).getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / 60_000);
  const formatter = new Intl.RelativeTimeFormat('es-PE', { numeric: 'auto' });

  const absMinutes = Math.abs(diffMinutes);
  if (absMinutes < 60) return formatter.format(diffMinutes, 'minute');
  if (absMinutes < 60 * 24) return formatter.format(Math.round(diffMinutes / 60), 'hour');
  return formatter.format(Math.round(diffMinutes / (60 * 24)), 'day');
}
