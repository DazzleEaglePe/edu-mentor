import type { ApiError } from '@edu-mentor/shared-types';

/**
 * Interfaz del cliente HTTP — **declarada, no implementada**.
 *
 * El transporte real depende del vertical slice de auth de Codex: cookies
 * `HttpOnly` + `Secure` + `SameSite`, cabecera CSRF y rotación de refresh
 * (DEC-005 / DEC-006). Inventar esas piezas aquí crearía un contrato paralelo.
 *
 * Lo que este archivo sí fija son las cuatro reglas que la implementación
 * deberá cumplir, para que estén escritas antes de que exista el código:
 *
 * 1. **Nunca `localStorage` ni `sessionStorage` para tokens.** El transporte
 *    son cookies que el JavaScript de la página no puede leer; guardarlas en
 *    almacenamiento accesible desde el DOM anula la defensa contra XSS.
 * 2. **Toda mutación viaja con la cabecera CSRF** obtenida de `GET /auth/csrf`.
 * 3. **`401` no se reintenta en bucle:** se intenta rotar una vez y, si falla,
 *    la sesión se considera cerrada.
 * 4. **El error se propaga como `ApiError`**, con su `code`; la UI redacta el
 *    texto. `message` nunca llega a pantalla.
 */

export interface RequestOptions {
  readonly signal?: AbortSignal;
  /** Requerido por el contrato en toda creación, para que un doble clic no duplique. */
  readonly idempotencyKey?: string;
}

/**
 * Resultado explícito en vez de excepciones: obliga a quien llama a decidir
 * qué hacer con el error, que es justo donde vive la UX de este producto.
 */
export type ApiResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: ApiError['error']; readonly status: number };

export interface ApiClient {
  get<T>(path: string, options?: RequestOptions): Promise<ApiResult<T>>;
  post<T>(path: string, body: unknown, options?: RequestOptions): Promise<ApiResult<T>>;
  put<T>(path: string, body: unknown, options?: RequestOptions): Promise<ApiResult<T>>;
  patch<T>(path: string, body: unknown, options?: RequestOptions): Promise<ApiResult<T>>;
  delete<T>(path: string, options?: RequestOptions): Promise<ApiResult<T>>;
}

/**
 * Error sintético para fallos de red o respuestas que ni siquiera traen el
 * envelope. La UI necesita algo con `code` y `traceId` para redactar, incluso
 * cuando el backend no llegó a responder.
 */
export function transportError(traceId = 'sin-traza'): ApiError['error'] {
  return {
    code: 'TRANSPORT_ERROR',
    message: 'network or transport failure',
    traceId,
  };
}
