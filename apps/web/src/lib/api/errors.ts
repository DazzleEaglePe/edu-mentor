import type { ApiComponents, ApiError } from '@edu-mentor/shared-types';
import { lookupOr } from '@/lib/domain/lookup';

/**
 * El backend devuelve `{ error: { code, message, traceId, details? } }`.
 *
 * Regla de `docs/design/09-copy.md` §8: **la UI redacta desde `code`** y nunca
 * muestra `message` crudo. Así el texto se mejora durante el piloto sin tocar
 * la API ni desplegar el backend.
 */

type Schemas = ApiComponents['schemas'];
type ScheduleConflictDetails = Schemas['ScheduleConflictDetails'];

export interface ErrorCopy {
  readonly title: string;
  readonly body: string;
  /** Acción sugerida. `null` cuando no hay salida distinta de volver. */
  readonly action: string | null;
  /** El código de soporte solo se muestra cuando de verdad ayuda a soporte. */
  readonly showTraceId: boolean;
}

const fallback: ErrorCopy = {
  title: 'Algo no salió como esperábamos',
  body: 'Inténtalo de nuevo. Si sigue pasando, comparte el código de soporte con tu coordinación.',
  action: 'Reintentar',
  showTraceId: true,
};

const catalog: Record<string, ErrorCopy> = {
  NOT_FOUND: {
    title: 'Este contenido no está disponible',
    body: 'Puede haber sido cancelado o ya no tienes acceso.',
    action: 'Volver',
    showTraceId: false,
  },
  FORBIDDEN: {
    title: 'No tienes acceso a esta sección',
    body: 'Si crees que es un error, escribe a tu coordinación.',
    action: 'Volver a mi inicio',
    showTraceId: false,
  },
  UNAUTHORIZED: {
    title: 'Tu sesión expiró',
    body: 'Por seguridad cerramos tu sesión después de un tiempo sin actividad.',
    action: 'Iniciar sesión',
    showTraceId: false,
  },
  VERSION_CONFLICT: {
    title: 'Alguien actualizó esto mientras trabajabas',
    body: 'Tus cambios no se guardaron para no sobrescribir los de otra persona. Copia lo que escribiste antes de recargar.',
    action: 'Recargar',
    showTraceId: false,
  },
  CONFIRMATION_CLOSED: {
    title: 'Ya no puedes cambiar tu respuesta',
    body: 'La confirmación cerró. Avisa a tu mentora si tu situación cambió.',
    action: null,
    showTraceId: false,
  },
  PAYLOAD_TOO_LARGE: {
    title: 'El archivo supera el límite',
    body: 'Comprímelo o divídelo en partes. Los archivos que ya subiste se conservan.',
    action: null,
    showTraceId: false,
  },
  UNSUPPORTED_MEDIA_TYPE: {
    title: 'Este formato no se acepta',
    body: 'Revisa los formatos permitidos en la consigna.',
    action: null,
    showTraceId: false,
  },
  /**
   * El backend valida cada criterio contra su propio `maxScore`. La UI ya lo
   * previene con `validateRubricScores`, así que este error solo debería llegar
   * si la rúbrica cambió mientras el mentor escribía.
   */
  SCORE_EXCEEDS_MAX: {
    title: 'Un puntaje supera el máximo del criterio',
    body: 'Revisa los criterios: cada uno tiene su propio máximo y puede haber cambiado.',
    action: 'Revisar puntajes',
    showTraceId: false,
  },
  EMAIL_ALREADY_EXISTS: {
    title: 'Ese correo ya está registrado',
    body: 'Busca a la persona en la lista: puede estar desactivada en vez de ausente.',
    action: 'Buscar en la lista',
    showTraceId: false,
  },
  /**
   * La operación ya ocurrió con esa clave: reintentar no debe alarmar ni
   * duplicar. Se informa el resultado, no un fallo.
   */
  IDEMPOTENCY_KEY_REUSED: {
    title: 'Esta acción ya se había realizado',
    body: 'No se creó nada por duplicado. Recarga para ver el resultado.',
    action: 'Recargar',
    showTraceId: false,
  },
};

/**
 * La búsqueda pasa por `lookupOr` para no repetir aquí la protección contra
 * claves heredadas de `Object.prototype` — ver `lookup.ts`.
 */
export function errorCopy(error: ApiError['error']): ErrorCopy {
  return lookupOr(catalog, error.code, fallback);
}

/**
 * `SCHEDULE_CONFLICT` tiene dos redacciones según lo que el actor puede ver.
 *
 * Con `canViewConflictingSession: false` el contrato ni siquiera entrega el id
 * de la sesión: no se nombra, no se enlaza y no se insinúa que exista. Y en
 * ningún caso prometemos "el siguiente horario libre" — el backend no lo
 * calcula, así que sugerirlo solo produce un segundo 409.
 */
export interface ScheduleConflictCopy extends ErrorCopy {
  readonly conflictingSessionId: string | null;
}

export function scheduleConflictCopy(
  details: ScheduleConflictDetails,
  resourceName: string,
  formatInterval: (startsAt: string, endsAt: string, timezone: string) => string,
): ScheduleConflictCopy {
  const interval = formatInterval(
    details.occupiedInterval.startsAt,
    details.occupiedInterval.endsAt,
    details.occupiedInterval.timezone,
  );

  const body = details.canViewConflictingSession
    ? `${resourceName} ya tiene una sesión ${interval}.`
    : `${resourceName} no está disponible ${interval}.`;

  return {
    title: 'Hay un cruce de horario',
    body,
    action: 'Elegir otro horario',
    showTraceId: false,
    conflictingSessionId: details.canViewConflictingSession ? details.conflictingSessionId : null,
  };
}

/**
 * Type guard del envelope, sin confiar en el `status` HTTP.
 *
 * Comprueba que los tres campos obligatorios sean **strings**, no solo que la
 * clave exista: `{ code: null }` pasaría un `'code' in candidate` y luego
 * reventaría al buscar el texto en el catálogo. Este guard es la frontera entre
 * una respuesta y datos en los que se puede confiar.
 */
export function isApiError(value: unknown): value is ApiError {
  if (typeof value !== 'object' || value === null || !('error' in value)) {
    return false;
  }

  const candidate = (value as { error: unknown }).error;
  if (typeof candidate !== 'object' || candidate === null) {
    return false;
  }

  const envelope = candidate as Record<string, unknown>;
  return (
    typeof envelope['code'] === 'string' &&
    typeof envelope['message'] === 'string' &&
    typeof envelope['traceId'] === 'string'
  );
}
