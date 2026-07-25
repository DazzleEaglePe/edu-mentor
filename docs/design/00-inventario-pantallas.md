# 00 · Inventario de pantallas — MVP vs. FUTURE

Fecha: 2026-07-25 · **sincronizado con el cierre de reconciliación** (`docs/checkpoints/2026-07-25-contract-reconciliation-closure.md`, `docs/11-contract-decisions.md`, `docs/12-domain-state-machines.md`, `docs/api/openapi.yaml` — 57 operaciones).

Regla: una pantalla es `MVP` solo si todo su contenido se sostiene con el contrato publicado. **Ya no queda ninguna `MVP*`**: todos los endpoints que el diseño necesita están publicados.

---

## 1. Transversales

| # | Pantalla | Etiqueta | Endpoints | Notas |
|---|---|---|---|---|
| T1 | Login | MVP | `POST /auth/login` · `GET /auth/csrf` | Cookies `HttpOnly` + CSRF, no Bearer (DEC-006). **Sin enlace "¿olvidaste tu contraseña?"** |
| T2 | ~~Recuperar contraseña~~ | **ELIMINADA** | — | CCR-007: reset manual por admin con contraseña temporal |
| T3 | Shell de portal | MVP | `GET /auth/me` | Nav por rol, ver §5 |
| T4 | Mi perfil | MVP | `GET /auth/me` · `POST /auth/change-password` | Cambio de contraseña autenticado |
| T5 | Estados del sistema | MVP | — | Ver `03-estados-ux.md` |
| T6 | **Cambio de contraseña obligatorio** | MVP | `POST /auth/change-password` | **Nueva.** `AuthMe.mustChangePassword = true` bloquea el portal hasta cambiarla |
| T7 | Sesión cerrada en todos los dispositivos | MVP | `POST /auth/logout-all` | Acción dentro de T4 |
| T8 | Landing pública | PENDIENTE | — | Gap-analysis pregunta 1 |

## 2. Participante

| # | Pantalla | Etiqueta | Endpoints | Notas |
|---|---|---|---|---|
| P1 | Inicio (dashboard) | MVP | `GET /dashboard/participant` | Métricas server-side: sesiones asistidas/total, entregas enviadas/esperadas, próxima sesión, próximo vencimiento |
| P2 | Mis sesiones | MVP | `GET /sessions` · `GET /sessions/calendar` | Filtros: `status`, `phase`, `from`, `to` |
| P3 | Detalle de sesión | MVP | `GET /sessions/{sessionId}` | Trae `confirmationClosesAt` y `canConfirm` |
| P4 | Confirmar o declinar asistencia | MVP | `PUT /sessions/{sessionId}/participants/me/confirmation` | Body `{status: CONFIRMED\|DECLINED, expectedVersion}`. Deshabilitado con motivo si `canConfirm = false`; fuera de ventana → `422 CONFIRMATION_CLOSED` |
| P5 | Solicitar reprogramación | **MVP** | `POST /sessions/{sessionId}/reschedule-requests` · `POST /reschedule-requests/{id}/cancel` | ✅ CCR-001 aprobada |
| P6 | Mis entregables | MVP | `GET /deliverables` | Filtro `status` por estado de revisión |
| P7 | Detalle de consigna + borrador | MVP | `GET /assignments/{assignmentId}` · `POST /deliverables` | La consigna trae su rúbrica (`rubric[]`) |
| P8 | Subir archivos y editar notas | MVP | `POST /deliverables/{id}/submissions/{submissionId}/files` · `DELETE …/files/{fileId}` · `PATCH /deliverables/{id}/submissions/{submissionId}` | Cada archivo tiene `scanStatus`. Las notas se guardan con `PATCH` mientras la revisión siga en `DRAFT` |
| P9 | Enviar revisión | MVP | `POST /deliverables/{id}/submissions/{submissionId}/submit` | Exige todos los archivos `CLEAN` |
| P10 | Ver feedback | MVP | `GET /deliverables/{deliverableId}` | Historial completo de revisiones + evaluación por revisión |
| P11 | Reenviar tras devolución | MVP | `POST /deliverables/{deliverableId}/submissions` | **Crea la siguiente revisión**, no recicla la anterior |
| P12 | Mi recorrido (fases) | **MVP** | `GET /auth/me` → `activeEnrollment` | ✅ CCR-002 aprobada: oleada, `currentPhase`, `currentWeek` |
| P13 | Descargar mi archivo | MVP | `GET …/files/{fileId}/download` | Auditada |
| P14 | Graduación Fase 1 → 2 | FUTURE | — | Fuera del piloto |
| P15 | Apoyo emocional | FUTURE | — | Fuera del piloto |

## 3. Mentor especialista

| # | Pantalla | Etiqueta | Endpoints | Notas |
|---|---|---|---|---|
| M1 | Inicio (dashboard) | MVP | `GET /dashboard/mentor` | `completedMinutes`, `upcomingSessions`, `pendingConfirmations`, `pendingRescheduleRequests`, `pendingReviews` |
| M2 | Mi agenda — lista | MVP | `GET /sessions` | |
| M3 | Mi agenda — calendario | MVP | `GET /sessions/calendar` | |
| M4 | Agendar sesión | MVP | `POST /sessions` | Requiere header `Idempotency-Key`. `timezone` obligatorio |
| M5 | Editar sesión | MVP | `PATCH /sessions/{sessionId}` | Solo título, descripción y `meetingUrl` + `expectedVersion` |
| M6 | Reprogramar sesión | MVP | `POST /sessions/{sessionId}/reschedule` | Requiere `reason` y `expectedVersion` |
| M7 | Cancelar sesión | MVP | `POST /sessions/{sessionId}/cancel` | Requiere `reason` y `expectedVersion` |
| M8 | Registrar asistencia | MVP | `PUT /sessions/{sessionId}/participants/{enrollmentId}/attendance` | `{status: ATTENDED\|ABSENT, expectedVersion}` |
| M9 | Completar sesión | MVP | `POST /sessions/{sessionId}/complete` | **Nueva.** `SCHEDULED → COMPLETED` |
| M10 | Crear y editar consigna | MVP | `POST /assignments` · `PATCH /assignments/{assignmentId}` | **Mentor y Admin**, ambos autorizados. Rúbrica configurable, `maxScore` fijo en 100. Editable solo antes de recibir revisiones enviadas |
| M11 | Cola de evaluación | MVP | `GET /deliverables/pending-review` | |
| M12 | Tomar revisión | MVP | `POST …/submissions/{submissionId}/start-review` | **Nueva.** `SUBMITTED → UNDER_REVIEW`, explícita |
| M13 | Evaluar revisión | MVP | `POST …/submissions/{submissionId}/evaluation` | `score` 0–100 + `feedback` + `rubricScores[]` + `expectedVersion` |
| M14 | Devolver para corrección | MVP | `POST …/submissions/{submissionId}/return` | |
| M15 | Decidir reprogramaciones | **MVP** | `GET /reschedule-requests` · `POST /reschedule-requests/{id}/approve` · `/reject` | ✅ CCR-001. Aprobar crea la sesión reemplazo |
| M16 | Top 3 por consigna | MVP | `GET/PUT /assignments/{assignmentId}/top-candidates` | ⚠️ **Regla provisional** (`provisionalRule: true`). No presentar como aprobada |
| M17 | Participantes asignados | MVP | `GET /admin/mentor-assignments` scopeado | ✅ CCR-012 |
| M18 | Descargar entrega | MVP | `GET …/files/{fileId}/download` | Auditada |
| M19 | Mensajería interna | FUTURE | — | |
| M20 | Checkpoints Fase 2 / mentor par | FUTURE | — | DEC-015 |

## 4. Admin

| # | Pantalla | Etiqueta | Endpoints | Notas |
|---|---|---|---|---|
| A1 | Dashboard operativo | MVP | `GET /dashboard/admin` | `activeUsers`, `upcomingSessions`, `pendingDeliverables`, `failedJobs` |
| A2 | Gestión de sesiones | MVP | `GET /sessions` + filtros | Admin ve toda la organización |
| A3 | Detalle/supervisión de sesión | MVP | `GET /sessions/{sessionId}` | Puede reprogramar, cancelar y completar |
| A4 | Gestión de entregables | MVP | `GET /deliverables` | |
| A5 | Usuarios y roles | MVP | `GET/POST /admin/users` · `PATCH /admin/users/{userId}` · `POST …/password-reset` | Roles múltiples (DEC-002). **`AdminUser` no expone oleada ni último acceso**: la oleada vive en `Enrollment` (A7) |
| A6 | Oleadas | MVP | `GET/POST /admin/oleadas` · `PATCH /admin/oleadas/{oleadaId}` | ✅ CCR-012. `activeEnrollmentCount` da la ocupación |
| A7 | Enrollments | MVP | `GET/POST /admin/enrollments` · `PATCH /admin/enrollments/{enrollmentId}` | Alta en `FASE_0` o `FASE_1`; `currentWeek` y `status` editables |
| A8 | Asignaciones mentor ↔ participante | MVP | `GET/POST /admin/mentor-assignments` · `DELETE …/{mentorAssignmentId}?expectedVersion=` | `enrollmentId` **nullable**: asignación por oleada o 1:1. Cerrar es `DELETE` → `204`; el historial se conserva |
| A9 | ~~Conflictos de agenda~~ | **ELIMINADA** | — | CCR-006: se previenen, no se listan |
| A10 | Jobs/recordatorios fallidos | DIFERIDA | `failedJobs` existe en el dashboard; sin endpoint de detalle | Fase 4 |
| A11 | Auditoría | DIFERIDA | pendiente (DEC-023) | Fase 4 |
| A12 | Postulaciones · Matching · Fases y graduación · Apoyo emocional · Reportes · Demo Day · certificados · IA · Job Tracking | FUTURE | — | DEC-015 · `RECHAZADA_MVP` |

---

## 5. Navegación aprobada para el piloto

```text
Participante   Inicio · Mis sesiones · Mis entregables · Mi perfil
Mentor         Inicio · Mi agenda · Evaluaciones · Participantes · Mi perfil
Admin          Dashboard · Sesiones · Entregables · Oleadas · Usuarios · Operación
```

`Oleadas` agrupa A6, A7 y A8 — son un solo flujo de configuración. `Operación` (A10 + A11) aparece solo con el permiso correspondiente y **se activa en Fase 4**; hasta entonces no está en la navegación.

## 6. Glosario UI ↔ enum — **contrato vigente**

La etiqueta en pantalla nunca inventa un estado. Un solo traductor en el código.

### Sesión — tres ejes independientes (DEC-007)

| Eje | Enum | Etiqueta UI |
|---|---|---|
| `session.status` | `SCHEDULED` | Programada |
| | `COMPLETED` | Realizada |
| | `CANCELLED` | Cancelada |
| | `RESCHEDULED` | Reprogramada |
| `confirmationStatus` | `PENDING` | Por confirmar |
| | `CONFIRMED` | Confirmada |
| | `DECLINED` | No asistiré |
| `attendanceStatus` | `PENDING` | Sin registrar |
| | `ATTENDED` | Asistió |
| | `ABSENT` | No asistió |

> **`CONFIRMED` ya no es estado de sesión.** Una sesión grupal es `SCHEDULED` aunque 5 de 8 hayan confirmado. La UI muestra la proporción, nunca un estado agregado.
> **`CONFIRMED` no implica `ATTENDED`, y `DECLINED` no implica `ABSENT`.** Son ejes que no se derivan uno del otro.

### Resto del dominio

| Dominio | Enum | Etiqueta UI |
|---|---|---|
| `session.type` | `ONE_ON_ONE` · `GROUP` · `CHECKPOINT` | 1:1 · Grupal · Checkpoint |
| `oleada.status` | `DRAFT` · `OPEN` · `IN_PROGRESS` · `CLOSED` | Borrador · Convocatoria · En curso · Cerrada |
| `enrollment.status` | `ACTIVE` · `WITHDRAWN` · `COMPLETED` | Activo · Retirado · Completado |
| `mentorAssignment.status` | `ACTIVE` · `CLOSED` | Vigente · Cerrada |
| `submission.status` | `DRAFT` · `SUBMITTED` · `UNDER_REVIEW` · `EVALUATED` · `RETURNED` | Borrador · Enviado · En evaluación · Evaluado · Devuelto |
| `rescheduleRequest.status` | `PENDING` · `APPROVED` · `REJECTED` · `CANCELLED` | Pendiente · Aprobada · Rechazada · Cancelada |
| `file.scanStatus` | `PENDING` · `CLEAN` · `REJECTED` · `ERROR` | Analizando · Listo · Bloqueado · No se pudo analizar |
| `enrollment.currentPhase` | `FASE_0` … `FINISHED` | Fase 0 · Selección / Fase 1 · Hub de Empleabilidad / Fase 2 · Acompañamiento / Programa finalizado |
| `role` | `PARTICIPANT` · `MENTOR` · `ADMIN` | Participante · Mentor · Admin |
| `mentorCapability` | `SPECIALIST` · `PEER` | Mentor especialista · Mentor par *(PEER no se usa en el piloto)* |

**Prohibido en UI:** "Pendiente" como estado de entregable · "Taller" o "Por programar" como estado/tipo de sesión · "Confirmada" como estado de la sesión · estrellas o escala /5 · cualquier atajo entre confirmación y asistencia · datos de una sesión en conflicto cuando `canViewConflictingSession = false` · prometer "el siguiente horario libre".

## 7. Conceptos del contrato que la UI debe respetar

| Concepto | Impacto en diseño |
|---|---|
| `expectedVersion` en toda mutación | Todo formulario de escritura debe manejar el `409` de versión: no se pierde lo escrito y se ofrece recargar |
| `Idempotency-Key` en creación | Un doble clic no crea dos sesiones ni dos entregables |
| Cookies + CSRF | No hay token en `localStorage`; la expiración se maneja con el `401` |
| `mustChangePassword` | Pantalla T6 bloqueante antes de cualquier otra |
| `scanStatus` por archivo | El botón de enviar espera a que todos estén `CLEAN` |
| `rubric[]` por consigna | Los criterios no están hardcodeados: vienen del assignment |
| `provisionalRule: true` | La UI de Top 3 debe decir que la regla es provisional |
| `hasNextPage` en `PageMeta` | Paginación por "cargar más"/siguiente, sin total de páginas calculado en cliente |
| `ErrorEnvelope` `{error:{code,message,traceId,details}}` | La UI redacta a partir de `code`; muestra `traceId` como "Código de soporte" |
| `canConfirm` + `confirmationClosesAt` | Confirmar y declinar se deshabilitan **con el motivo visible**, no en silencio |
| `confirmationSummary` | El "5 de 8" del mentor y del admin sale de aquí, no de contar participantes |
| `ScheduleConflictDetails.canViewConflictingSession` | Dos redacciones del `409`; el enlace a la sesión en conflicto **solo existe si es `true`** |
| `MentorAssignment.enrollmentId` nullable | Una asignación puede ser de oleada completa o de un participante |
| `Oleada.activeEnrollmentCount` | Ocupación sin pedir la lista de enrollments |
