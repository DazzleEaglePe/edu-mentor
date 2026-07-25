# 03 · Diseño de API — baseline MVP

Versión 3 · REST NestJS · prefijo `/api/v1` · JSON salvo uploads.

El contrato aplica RBAC, asignaciones y ownership en service. Ocultar un botón o filtrar una lista en frontend no constituye autorización.

## 1. Convenciones

### Respuesta paginada

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "hasNextPage": false
  }
}
```

### Error

```json
{
  "error": {
    "code": "SCHEDULE_CONFLICT",
    "message": "El horario ya no está disponible.",
    "traceId": "01J...",
    "details": {
      "resourceType": "ENROLLMENT",
      "resourceId": "uuid",
      "occupiedInterval": {
        "startsAt": "2026-08-12T20:00:00Z",
        "endsAt": "2026-08-12T20:45:00Z",
        "timezone": "America/Lima"
      },
      "canViewConflictingSession": false,
      "conflictingSessionId": null
    }
  }
}
```

`code` es estable y traducible; `message` es segura para usuario; `traceId` conecta UI, logs y auditoría. `details` nunca expone stack, SQL, tokens ni información de otro usuario.

Para `SCHEDULE_CONFLICT`, `resourceId` corresponde a un recurso enviado o autorizado en la operación. `conflictingSessionId` solo se devuelve si el actor puede consultar esa sesión; no se incluyen título ni terceros. El MVP no calcula un “próximo horario libre”.

### Concurrencia e idempotencia

- Mutaciones críticas envían `expectedVersion` y devuelven `409 VERSION_CONFLICT` si el registro cambió.
- Crear sesión, aprobar reprogramación y enviar revisión requieren `Idempotency-Key`.
- Repetir la misma key con el mismo payload devuelve el resultado original; con otro payload devuelve `409 IDEMPOTENCY_KEY_REUSED`.
- Fechas usan ISO-8601 UTC; la respuesta incluye `timezone` IANA para presentar hora local.

## 2. Autenticación

El portal usa dos cookies:

- access: JWT 15 min, `HttpOnly`, `Secure`, `SameSite=Lax`;
- refresh: secreto opaco 7 días, path restringido a auth, mismas flags.

El refresh se guarda solo como hash, rota en cada uso y pertenece a una familia revocable. Las mutaciones validan `Origin/Referer` y token CSRF enviado en `X-CSRF-Token`. No se usa `localStorage`.

| Método | Endpoint | Acceso | Uso |
|---|---|---|---|
| POST | `/auth/login` | Público | Inicia sesión y crea familia refresh. |
| POST | `/auth/refresh` | Cookie refresh | Rota tokens. |
| POST | `/auth/logout` | Autenticado | Revoca la sesión actual y limpia cookies. |
| POST | `/auth/logout-all` | Autenticado | Revoca todas las sesiones del usuario. |
| GET | `/auth/csrf` | Público same-site | Entrega token CSRF vinculado al navegador. |
| GET | `/auth/me` | Autenticado | Identidad, roles, capacidades y contexto activo. |
| POST | `/auth/change-password` | Autenticado | Verifica contraseña actual, cambia hash y revoca otras sesiones. |

Respuesta relevante de `/auth/me`:

```json
{
  "id": "usr_...",
  "fullName": "Participante Demo",
  "email": "demo@example.test",
  "organization": { "id": "org_...", "name": "EDU-US" },
  "roles": ["PARTICIPANT"],
  "mentorCapabilities": [],
  "activeEnrollment": {
    "id": "enr_...",
    "oleada": { "id": "ol_...", "name": "Oleada Tecnología 2026" },
    "currentPhase": "FASE_1",
    "currentWeek": 4
  },
  "mustChangePassword": false
}
```

No se habilita “Olvidé mi contraseña” hasta elegir un canal. En el piloto:

| Método | Endpoint | Rol | Uso |
|---|---|---|---|
| POST | `/admin/users/:userId/password-reset` | Admin | Define contraseña temporal, exige cambio y revoca sesiones. |

La contraseña temporal se comparte fuera de la plataforma mediante el procedimiento operativo aprobado; no aparece en logs ni respuestas posteriores.

## 3. Administración mínima

| Método | Endpoint | Rol | Uso |
|---|---|---|---|
| GET/POST | `/admin/users` | Admin | Listar/crear usuarios de la organización. |
| PATCH | `/admin/users/:id` | Admin | Perfil, activación y roles permitidos. |
| GET/POST | `/admin/oleadas` | Admin | Listar/crear oleadas. |
| PATCH | `/admin/oleadas/:id` | Admin | Editar o transicionar estado. |
| GET/POST | `/admin/enrollments` | Admin | Listar/crear enrollments. |
| PATCH | `/admin/enrollments/:id` | Admin | Estado, fase y semana según transición válida. |
| GET/POST | `/admin/mentor-assignments` | Admin | Gestionar alcance de mentores. |
| DELETE | `/admin/mentor-assignments/:id` | Admin | Cerrar asignación; no borrar auditoría. |

Toda ruta queda limitada a `organization_id` del admin.

Contratos mínimos:

```typescript
type CreateOleadaRequest = {
  name: string;
  sector: string;
  startDate: string;
  endDate: string;
  capacity: number;
};

type CreateEnrollmentRequest = {
  userId: string;
  oleadaId: string;
  currentPhase?: 'FASE_0' | 'FASE_1';
};

type CreateMentorAssignmentRequest = {
  mentorUserId: string;
  oleadaId: string;
  enrollmentId?: string; // null/omitido = alcance de cohorte
  capability: 'SPECIALIST'; // PEER no se opera en el MVP
  startsAt: string;
  endsAt?: string;
};
```

## 4. Dashboards derivados

No hay encuestas, satisfacción, campana, feed ni porcentajes históricos en el MVP.

| Método | Endpoint | Rol | Métricas |
|---|---|---|---|
| GET | `/dashboard/participant` | Participant | sesiones asistidas/total, entregables enviados/esperados, próxima sesión y próximo vencimiento. |
| GET | `/dashboard/mentor` | Mentor | horas completadas, sesiones próximas, confirmaciones pendientes, reprogramaciones pendientes y revisiones por evaluar. |
| GET | `/dashboard/admin` | Admin | sesiones próximas, entregas pendientes, usuarios activos y jobs fallidos. |

Los agregados se calculan server-side con definiciones documentadas; no dependen de páginas parciales devueltas por endpoints de lista.

## 5. Agenda y sesiones

### Lectura y workflow

| Método | Endpoint | Rol | Uso |
|---|---|---|---|
| GET | `/sessions` | Todos | Lista scoped; `phase` acepta solo `FASE_1|FASE_2`. Incluye resumen de confirmaciones. |
| GET | `/sessions/calendar` | Todos | Lista liviana por rango; mismo scoping. |
| GET | `/sessions/:id` | Todos | Detalle si existe ownership/asignación. |
| POST | `/sessions` | Mentor, Admin | Crea sesión y reservas atómicamente. |
| PATCH | `/sessions/:id` | Mentor, Admin | Edita contenido no temporal con `expectedVersion`. |
| POST | `/sessions/:id/reschedule` | Mentor, Admin | Reemplaza directamente, preservando historial. |
| POST | `/sessions/:id/cancel` | Mentor, Admin | Cancela y libera reservas. |
| POST | `/sessions/:id/complete` | Mentor, Admin | Completa después del horario. |
| PUT | `/sessions/:id/participants/me/confirmation` | Participant | `CONFIRMED` o `DECLINED`. |
| PUT | `/sessions/:id/participants/:enrollmentId/attendance` | Mentor, Admin | `ATTENDED` o `ABSENT`. |

Filtros:

```text
?oleadaId=...
&phase=FASE_1
&status=SCHEDULED
&type=ONE_ON_ONE
&weekNumber=3
&checkpointMonth=3
&from=2026-08-01T00:00:00Z
&to=2026-09-01T00:00:00Z
&page=1&limit=20
```

DTO de creación:

```typescript
type CreateSessionRequest = {
  oleadaId: string;
  mentorUserId?: string; // admin puede elegir; mentor usa su propia identidad
  title: string;
  description?: string;
  type: 'ONE_ON_ONE' | 'GROUP' | 'CHECKPOINT';
  phase: 'FASE_1' | 'FASE_2';
  weekNumber?: number;
  checkpointMonth?: 1 | 2 | 3 | 6;
  startsAt: string;
  durationMinutes: number;
  timezone: string;
  meetingUrl?: string;
  enrollmentIds: string[];
};
```

El service calcula `endsAt`; valida fase, asignaciones, participantes de la oleada, intervalo y URL; la DB impide traslapes. Un choque devuelve `409 SCHEDULE_CONFLICT`.

Cada `SessionSummary` incluye:

```typescript
type ConfirmationSummary = {
  total: number;
  pending: number;
  confirmed: number;
  declined: number;
};
```

También expone `confirmationClosesAt` y `canConfirm`. En el piloto el cierre coincide con `startsAt`; confirmar después devuelve `422 CONFIRMATION_CLOSED`.

### Solicitudes de reprogramación

| Método | Endpoint | Rol | Uso |
|---|---|---|---|
| POST | `/sessions/:id/reschedule-requests` | Participant | Crea solicitud propia pendiente. |
| GET | `/reschedule-requests` | Todos | Participante: propias; mentor: sesiones autorizadas; admin: organización. |
| POST | `/reschedule-requests/:id/approve` | Mentor, Admin | Decide y crea sesión reemplazo atómicamente. |
| POST | `/reschedule-requests/:id/reject` | Mentor, Admin | Rechaza con motivo. |
| POST | `/reschedule-requests/:id/cancel` | Participant | Cancela su solicitud pendiente. |

```typescript
type CreateRescheduleRequest = {
  proposedStartsAt?: string;
  reason: string;
};

type ApproveRescheduleRequest = {
  startsAt: string;
  durationMinutes?: number;
  meetingUrl?: string;
  expectedSessionVersion: number;
};
```

No existe una ruta para que participante solicite una sesión nueva.

### Eventos

- `session.scheduled`
- `session.rescheduled`
- `session.cancelled`
- `session.completed`
- `session.confirmation_changed`
- `session.attendance_recorded`
- `session.reschedule_requested`
- `session.reschedule_decided`

El evento y el cambio se guardan juntos en outbox.

## 6. Assignments, entregables y revisiones

### Assignments

| Método | Endpoint | Rol | Uso |
|---|---|---|---|
| GET | `/assignments` | Todos | Lista scoped por oleada/rol. |
| GET | `/assignments/:id` | Todos | Consigna y rúbrica autorizadas. |
| POST | `/assignments` | Mentor, Admin | Crea consigna 0–100. |
| PATCH | `/assignments/:id` | Mentor, Admin | Edita mientras no tenga submissions enviadas. |

### Deliverables y submissions

| Método | Endpoint | Rol | Uso |
|---|---|---|---|
| GET | `/deliverables` | Todos | Lista scoped; `status` filtra el estado de `currentSubmissionId`. |
| GET | `/deliverables/pending-review` | Mentor, Admin | Cola de submissions enviadas. |
| GET | `/deliverables/:id` | Todos | Agregado con historial autorizado. |
| POST | `/deliverables` | Participant | Crea agregado + revisión 1 `DRAFT`. |
| POST | `/deliverables/:id/submissions` | Participant | Nueva revisión `DRAFT` tras una devolución. |
| PATCH | `/deliverables/:id/submissions/:submissionId` | Participant | Edita notas de su draft. |
| POST | `/deliverables/:id/submissions/:submissionId/files` | Participant | Sube archivo al draft. |
| DELETE | `/deliverables/:id/submissions/:submissionId/files/:fileId` | Participant | Quita archivo del draft. |
| POST | `/deliverables/:id/submissions/:submissionId/submit` | Participant | Congela y envía revisión limpia. |
| POST | `/deliverables/:id/submissions/:submissionId/start-review` | Mentor, Admin | Toma revisión para evaluar. |
| POST | `/deliverables/:id/submissions/:submissionId/evaluation` | Mentor, Admin | Crea evaluación inmutable 0–100. |
| POST | `/deliverables/:id/submissions/:submissionId/return` | Mentor, Admin | Devuelve con motivo; habilita siguiente draft. |
| GET | `/deliverables/:id/submissions/:submissionId/files/:fileId/download` | Autorizado | URL corta firmada o stream auditado. |

DTO de evaluación:

```typescript
type EvaluateSubmissionRequest = {
  score: number; // integer 0..100
  feedback: string;
  rubricScores: Array<{
    criterionId: string;
    score: number;
    comment?: string;
  }>;
  expectedVersion: number;
};
```

No se confía en extensión ni MIME declarado por el navegador. El backend genera nombre/object key, detecta MIME, calcula hash, limita tamaño y exige scan `CLEAN` antes de submit/download.

### Top 3 provisional

| Método | Endpoint | Rol | Uso |
|---|---|---|---|
| GET | `/assignments/:id/top-candidates` | Mentor, Admin | Ranking actual de esa consigna. |
| PUT | `/assignments/:id/top-candidates` | Mentor, Admin | Reemplaza ranking completo de 0–3 puestos en una transacción. |

```typescript
type ReplaceTopCandidatesRequest = {
  candidates: Array<{
    submissionId: string;
    rank: 1 | 2 | 3;
  }>;
  expectedVersion: number;
};
```

La regla por assignment requiere ratificación de Producto antes de habilitar la UI final.

### Eventos

- `deliverable.submitted`
- `deliverable.review_started`
- `deliverable.evaluated`
- `deliverable.returned`
- `assignment.top_candidates_changed`
- `file.scan_completed`

## 7. Permisos resumidos

| Acción | Participant | Mentor | Admin |
|---|:---:|:---:|:---:|
| Ver sesión | propia | asignada/impartida | organización |
| Crear/reprogramar sesión | — | alcance asignado | organización |
| Solicitar reprogramación | propia | — | — |
| Confirmar | propia | — | — |
| Registrar asistencia | — | sesión impartida | organización |
| Editar draft/subir | propio | — | — |
| Evaluar/devolver | — | alcance asignado | organización |
| Gestionar soporte | — | — | organización |

Los detalles de un recurso ajeno responden `404 RESOURCE_NOT_FOUND` cuando revelar su existencia pueda filtrar información.

## 8. HTTP, documentación y exclusiones

- `200`, `201`, `204` para éxito.
- `400` sintaxis/DTO; `401` autenticación; `403` acción conocida no permitida; `404` ocultamiento/ausencia.
- `409` concurrencia, idempotencia o conflictos; `422` transición/regla semántica.
- OpenAPI se genera desde DTOs y decorators y se valida en CI.
- `packages/shared-types` se genera/deriva del contrato; no mantiene un segundo contrato manual divergente.

No se publican rutas Job Tracking, mentoría par operativa, certificados, citas psicológicas, IA ni centro de notificaciones durante el piloto.
