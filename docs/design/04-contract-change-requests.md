# 04 · Contract change requests → Codex

Abiertas el 2026-07-25 · **respondidas el 2026-07-25** en `docs/11-contract-decisions.md` y `docs/checkpoints/2026-07-25-contract-reconciliation-closure.md`.

**12 CCR procesadas; 11 cerradas y CCR-008 pendiente de Producto.** Ninguna espera respuesta de Codex. El contrato ejecutable está en `docs/api/openapi.yaml` (57 operaciones).

---

## Resultado

| CCR | Respuesta de Codex | Qué hice en el diseño |
|---|---|---|
| **001** · Solicitud de reprogramación | ✅ **ACEPTADO** | P5 y M15 pasan de `MVP*` a `MVP`. Flujo completo con 4 estados |
| **002** · Fase del participante | ✅ **ACEPTADO** | P12 y el badge de contexto pasan a `MVP`. Salen de `GET /auth/me` |
| **003** · Solicitudes de sesión | ❌ **RECHAZADO_MVP** | Usé la alternativa que propuse: el panel del mentor muestra confirmaciones y reprogramaciones pendientes |
| **004** · Métricas de dashboard | ⚖️ **ACEPTADO_PARCIAL** | Mejor de lo que pedí: 3 endpoints server-side. Sin satisfacción ni variaciones porcentuales |
| **005** · Escala de calificación | ✅ **ACEPTADO** | 0–100 en toda la UI. Rúbrica configurable por consigna |
| **006** · Conflictos de agenda | ⚖️ **ALTERNATIVA_ACEPTADA** | Eliminé el panel A7. Los conflictos se previenen y se muestran como `409` al crear |
| **007** · Contraseñas | ⚖️ **ALTERNATIVA_ACEPTADA** | Eliminé T2 y el enlace del login. Agregué T6 (cambio obligatorio) y el reset de admin en A5 |
| **008** · Regla del Top 3 | ⏳ **PENDIENTE_PRODUCTO** | Diseñado por consigna con puestos 1–3 y **etiquetado como provisional** en pantalla |
| **009** · Notificaciones in-app | ⚖️ **ALTERNATIVA_ACEPTADA** | Sin campana ni feed. Próxima sesión y próximo vencimiento vienen del dashboard |

---

## Cambios que el contrato introdujo y el diseño tuvo que absorber

Estos no salieron de una CCR mía: son decisiones de Codex que cambiaron pantallas.

| Cambio | Origen | Impacto |
|---|---|---|
| `CONFIRMED` deja de ser estado de sesión | DEC-007 | Reescritura del glosario y de todos los chips de sesión |
| `confirmationStatus` y `attendanceStatus` separados | DEC-007 | Dos ejes distintos en la UI; `DECLINED` es un estado nuevo que el participante puede elegir |
| Rutas de entregables con `submissionId` | DEC-010/011 | Todas las acciones de entregable apuntan a una revisión concreta |
| `POST /submissions` crea la siguiente revisión | `12-domain-state-machines.md` §4 | El reenvío es una pantalla propia (P11), no un "editar y reenviar" |
| `start-review` explícito | Ídem | El mentor **toma** la revisión; `UNDER_REVIEW` deja de ser automático (M12) |
| `POST /sessions/{id}/complete` | §1 | Acción nueva del mentor (M9) |
| `expectedVersion` en toda mutación | DEC-028 | Cada formulario maneja el `409` de versión sin perder lo escrito |
| `Idempotency-Key` al crear | DEC-014 | Doble clic no duplica |
| Cookies `HttpOnly` + CSRF | DEC-006 | Sin token en `localStorage`; expiración vía `401` |
| `mustChangePassword` | P1 operativa | Pantalla T6 bloqueante |
| `scanStatus` por archivo | DEC-021 | El envío espera a que todos estén `CLEAN` |
| Rúbrica por consigna | CCR-005 | Los criterios vienen del assignment, no hardcodeados |
| `ErrorEnvelope` anidado | DEC-027 | `{error:{code,message,traceId,details}}` |

---

## Segunda ronda — también cerrada

### CCR-010 · Payload del `409` de traslape — ✅ **ACEPTADO**

Codex publicó `ScheduleConflictDetails` tipado: `resourceType` (`USER`|`ENROLLMENT`), `resourceId`, `occupiedInterval` (con `timezone`) y `canViewConflictingSession` + `conflictingSessionId` nullable.

**Resolvió mejor de lo que pedí en el punto de privacidad:** yo propuse "no filtrar el título ni el mentor"; el contrato va más lejos y oculta hasta la existencia del `conflictingSessionId` cuando el ownership no lo permite. El diseño ahora tiene **dos redacciones** (`03-estados-ux.md` §3.1) y el enlace "Ver la sesión" solo se renderiza cuando `canViewConflictingSession: true`.

**Rechazado con razón:** el "siguiente horario libre" que propuse como opcional. El MVP no lo calcula, así que lo saqué de wireframes y copy — sugerir un hueco no validado solo produce un segundo `409`.

### CCR-011 · Cutoff de confirmación — ✅ **ACEPTADO**

`SessionSummary` expone `confirmationClosesAt` (en el piloto = `startsAt`) y `canConfirm`, contextual al usuario autenticado. Fuera de ventana: `422 CONFIRMATION_CLOSED` con `confirmationClosesAt` en `details`.

El diseño deshabilita confirmar y declinar **con el motivo visible**, en vez de dejar que la persona choque contra un error.

### CCR-012 · Endpoints administrativos — ✅ **ACEPTADO**

`/admin/oleadas`, `/admin/enrollments`, `/admin/mentor-assignments` más `PATCH /admin/users/{userId}`. **A6 y M17 dejan de ser `MVP*` y el journey J-A1 queda desbloqueado.**

Cerrar una asignación es **`DELETE /admin/mentor-assignments/{mentorAssignmentId}?expectedVersion=`** → `204`, no un `PATCH`. Semánticamente correcto: la acción es "cerrar", no "editar campos", y el historial se conserva igual.

Detalles que cambiaron el diseño:

- `Oleada.activeEnrollmentCount` → el paso 3 del setup muestra ocupación real sin pedir la lista de enrollments.
- `MentorAssignment.enrollmentId` es **nullable** → una asignación puede ser de oleada completa, no solo 1:1. La pantalla de asignaciones necesita ambos modos.
- `MentorAssignment.capability` (`SPECIALIST`|`PEER`) y `status` (`ACTIVE`|`CLOSED`) → reasignar cierra la anterior, no la borra.
- `Enrollment.currentWeek` y `phase1GraduatedAt` → el recorrido del participante sale del enrollment, no de un cálculo en cliente.

### Precisiones menores — todas resueltas

| Lo que pregunté | Respuesta |
|---|---|
| `GET /sessions?phase=` admitía `ProgramPhase` | Corregido a `SessionPhase` |
| ¿`GET /deliverables?status=` filtra por revisión vigente? | Sí, confirmado |
| `SessionSummary` sin proporción de confirmaciones | Agregado `confirmationSummary` {total, pending, confirmed, declined} |
| ¿El participante ve sus reschedule-requests? | Sí, scoping explícito por participante, mentor y admin |
| `failedJobs` sin pantalla de detalle | Confirmado: número sin enlace hasta Fase 4 |
| Tipos, tamaño y retención de archivos | Sigue pendiente de **Producto**, no de contrato |
| ¿`POST /assignments` es de mentor o de admin? | **Ambos.** Pregunta cerrada |

### Añadidos de la auditoría de Codex

Dos operaciones que faltaban y que el diseño ya necesitaba:

- **`PATCH /assignments/{assignmentId}`** → M10 puede corregir una consigna **hasta que llegue la primera revisión enviada**. Después queda congelada: cambiar la rúbrica más tarde invalidaría evaluaciones ya hechas.
- **`PATCH /deliverables/{deliverableId}/submissions/{submissionId}`** → P8 puede guardar las "Notas para tu mentora" mientras la revisión siga en `DRAFT`. Ese campo existía en el wireframe sin ruta de guardado; ahora la tiene.

---

## Resumen

| CCR | Estado |
|---|---|
| 001 · 002 · 005 · 010 · 011 · 012 | ✅ Aceptadas — aplicadas al diseño |
| 003 · 004 · 006 · 007 · 009 | ⚖️ Cerradas con alternativa — aplicadas al diseño |
| 008 · Top 3 | ⏳ **Pendiente de Producto** — diseñado como provisional |

**12 CCR procesadas; 11 cerradas y CCR-008 pendiente de Producto.** Ninguna espera respuesta de Codex. Si aparece una contradicción nueva durante Fase 1, vuelve por este mismo protocolo.
