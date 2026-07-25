# 05 · Journeys MVP por rol

Sincronizado con el cierre de reconciliación (`docs/checkpoints/2026-07-25-contract-reconciliation-closure.md`) y `docs/api/openapi.yaml`.
Estado: **propuesta para validar con Proyectos**. Ningún paso depende ya de un contrato pendiente.

Cada paso declara pantalla, endpoint real y estado resultante. Contexto: una oleada, 15–20 participantes, `America/Lima`, Fase 1 de 6 semanas con 1 sesión grupal + 1 sesión 1:1 por semana.

---

## 1. Participante

### J-P1 · Primer ingreso

| # | Pantalla | Acción | Endpoint | Resultado |
|---|---|---|---|---|
| 1 | Login (T1) | Ingresa con la contraseña temporal que le dio la coordinación | `GET /auth/csrf` → `POST /auth/login` | Cookies `HttpOnly` |
| 2 | Cambio obligatorio (T6) | Define su contraseña | `POST /auth/change-password` | `mustChangePassword = false` |
| 3 | Inicio (P1) | Ve oleada, fase y semana | `GET /auth/me` → `activeEnrollment` | — |
| 4 | Inicio | Ve próxima sesión, próximo vencimiento y sus conteos | `GET /dashboard/participant` | — |

**Momento de verdad:** en los primeros 10 segundos debe entender qué sigue. La pantalla responde en este orden: cuándo es mi próxima sesión · qué debo entregar y cuándo vence · tengo feedback nuevo.

**Fricción conocida:** el paso 2 es un muro para alguien que entra desde el celular con una contraseña temporal larga. El campo permite pegar y mostrar la contraseña.

### J-P2 · Confirmar o declinar asistencia — *el journey más frecuente*

| # | Pantalla | Acción | Endpoint | Resultado |
|---|---|---|---|---|
| 1 | Mis sesiones (P2) | Ve su confirmación por sesión | `GET /sessions` | `confirmationStatus = PENDING` |
| 2 | Detalle (P3) | Abre la sesión | `GET /sessions/{sessionId}` | — |
| 3 | Detalle | Confirma | `PUT /sessions/{id}/participants/me/confirmation` `{CONFIRMED, expectedVersion}` | `CONFIRMED` |
| 4 | Detalle | O declina | mismo endpoint con `{DECLINED, …}` | `DECLINED` |
| 5 | Detalle | Si necesita otro horario, solicita reprogramación | `POST /sessions/{id}/reschedule-requests` | Solicitud `PENDING` |
| 6 | Detalle | El día de la sesión entra por `meetingUrl` | — | — |
| 7 | Después | El mentor registra su asistencia | `PUT …/attendance` (lo hace el mentor) | `ATTENDED` / `ABSENT` |

**Decisión de diseño:** declinar y solicitar reprogramación son cosas distintas y la pantalla lo dice. *Declinar* = no voy, la sesión sigue. *Solicitar reprogramación* = pido otra fecha para todos. La segunda es más pesada y va como acción secundaria.

**Ventana de confirmación (✅ CCR-011).** La sesión trae `confirmationClosesAt` — en el piloto coincide con `startsAt` — y `canConfirm`. Cuando cierra, ambos controles se deshabilitan **con el motivo en pantalla**: "La confirmación cerró el {fecha}". La persona no se entera chocando contra un error.

**Qué puede fallar:** `409` de versión si el mentor reprogramó mientras miraba (se recarga sin perder nada); sesión `CANCELLED` (banner, no error genérico); intentar confirmar desde una pestaña vieja → `422 CONFIRMATION_CLOSED`, que trae `confirmationClosesAt` para redactar el mismo mensaje.

### J-P3 · Entregar un trabajo

| # | Pantalla | Acción | Endpoint | Resultado |
|---|---|---|---|---|
| 1 | Mis entregables (P6) | Ve la consigna y su vencimiento | `GET /deliverables` | — |
| 2 | Consigna (P7) | Lee instrucciones y criterios de la rúbrica | `GET /assignments/{assignmentId}` | — |
| 3 | Consigna | Crea el entregable | `POST /deliverables` + `Idempotency-Key` | Revisión 1 en `DRAFT` |
| 4 | Subir (P8) | Adjunta archivos y escribe notas | `POST …/submissions/{submissionId}/files` · `PATCH …/submissions/{submissionId}` | Cada archivo `scanStatus: PENDING`; las notas se guardan en `DRAFT` |
| 5 | Subir | Espera el análisis | — | `CLEAN` (o `REJECTED`/`ERROR`) |
| 6 | Subir | Quita un archivo si se equivocó | `DELETE …/files/{fileId}` | Solo en `DRAFT` |
| 7 | Enviar (P9) | Envía con confirmación explícita | `POST …/submissions/{submissionId}/submit` | `SUBMITTED`, revisión congelada |
| 8 | Feedback (P10) | Lee la evaluación | `GET /deliverables/{deliverableId}` | `EVALUATED` |

**Momento de verdad:** el paso 7. El envío congela una revisión inmutable, así que la confirmación dice qué se envía y que **podrá reenviar si el mentor devuelve**. Sin esa frase, el participante posterga por miedo a equivocarse.

**Nuevo respecto de la versión anterior:** el paso 5. Un archivo recién subido **no está listo**: hay que esperar el scan. El botón de enviar explica qué falta en vez de quedarse gris sin motivo.

### J-P4 · Recibir devolución y reenviar

| # | Pantalla | Acción | Endpoint | Resultado |
|---|---|---|---|---|
| 1 | Mis entregables (P6) | Ve `Devuelto` con el motivo | `GET /deliverables` | `RETURNED` |
| 2 | Feedback (P10) | Lee qué corregir | `GET /deliverables/{deliverableId}` | — |
| 3 | Reenviar (P11) | **Crea la siguiente revisión** | `POST /deliverables/{deliverableId}/submissions` | Revisión n+1 en `DRAFT` |
| 4 | Subir (P8) | Adjunta la versión corregida | `POST …/{nuevaSubmissionId}/files` | — |
| 5 | Enviar (P9) | Reenvía | `POST …/{nuevaSubmissionId}/submit` | `SUBMITTED`; historial intacto |

**Cambio de contrato importante:** reenviar **no** es editar la entrega anterior. Crea una revisión nueva encadenada por `previousSubmissionId`. La UI lo hace explícito: "Crear versión 2" con la versión 1 visible y en solo lectura al lado.

### J-P5 · Ver su recorrido

Solo lectura desde `GET /auth/me`: oleada, `currentPhase`, `currentWeek`. Sin graduación ni Fase 2 operativa (FUTURE).

---

## 2. Mentor especialista

### J-M1 · Agendar la semana

| # | Pantalla | Acción | Endpoint | Resultado |
|---|---|---|---|---|
| 1 | Mi agenda (M2/M3) | Revisa su semana | `GET /sessions` · `GET /sessions/calendar` | — |
| 2 | Agendar (M4) | Crea la sesión grupal | `POST /sessions` + `Idempotency-Key` | `SCHEDULED`, confirmaciones en `PENDING` |
| 3 | Agendar (M4) | Crea las 1:1 de la semana | ídem | `SCHEDULED` |
| 4 | Agendar | Si hay traslape, `409 SCHEDULE_CONFLICT` | — | Detalles tipados; ver abajo |
| 5 | Mi agenda | Ve quién confirmó y quién declinó | `confirmationSummary` en `GET /sessions` | "5 confirmaron · 1 no asistirá · 2 sin responder" |

**Regla de diseño:** el formulario cambia según `phase`. `FASE_1` pide `weekNumber` (1–6); `FASE_2` pide `checkpointMonth` (1, 2, 3 o 6). Nunca ambos, nunca ninguno — y `timezone` es obligatorio en el contrato, así que la UI lo muestra en vez de asumirlo en silencio.

**El conflicto (✅ CCR-010).** El `409` trae `resourceType`, `resourceId`, `occupiedInterval` y `canViewConflictingSession`. Si el mentor puede ver la sesión en conflicto, se le ofrece abrirla; si no, solo se le dice que la persona no está disponible en ese intervalo. **El MVP no promete "el siguiente horario libre"** — el contrato no lo calcula y sugerir un hueco no validado solo produce un segundo `409`.

**Fricción real:** crear 15 sesiones 1:1 una por una es tedioso. No propongo creación masiva para el piloto (multiplicaría conflictos y riesgo transaccional); sí que el formulario recuerde duración, semana, zona y enlace entre creaciones. El `Idempotency-Key` protege del doble clic.

### J-M2 · Reprogramar, cancelar, completar

| # | Pantalla | Acción | Endpoint | Resultado |
|---|---|---|---|---|
| 1 | Mi agenda (M2) | Abre la sesión | `GET /sessions/{sessionId}` | — |
| 2 | Reprogramar (M6) | Nueva fecha + motivo | `POST /sessions/{id}/reschedule` | Original `RESCHEDULED`, nueva `SCHEDULED` |
| 3 | — | Se notifica; las confirmaciones se reinician | evento | `PENDING` de nuevo |
| 4 | Cancelar (M7) | Cancela con motivo | `POST /sessions/{id}/cancel` | `CANCELLED`, reservas liberadas |
| 5 | Completar (M9) | Marca la sesión como realizada | `POST /sessions/{id}/complete` | `COMPLETED` |
| 6 | Asistencia (M8) | Registra quién asistió | `PUT …/participants/{enrollmentId}/attendance` | `ATTENDED` / `ABSENT` |

**Nuevo:** completar es una acción explícita del mentor, no un cambio automático por hora. La UI la ofrece cuando la sesión ya empezó, junto con el registro de asistencia — son el mismo momento operativo.

Los tres endpoints exigen `expectedVersion`: si alguien tocó la sesión antes, se avisa y se recarga sin perder el motivo escrito.

### J-M3 · Decidir solicitudes de reprogramación — *nuevo, CCR-001 aprobada*

| # | Pantalla | Acción | Endpoint | Resultado |
|---|---|---|---|---|
| 1 | Inicio (M1) | Ve `pendingRescheduleRequests` | `GET /dashboard/mentor` | — |
| 2 | Solicitudes (M15) | Revisa la solicitud y el motivo | `GET /reschedule-requests?status=PENDING` | `PENDING` |
| 3 | Solicitudes | Aprueba proponiendo horario | `POST /reschedule-requests/{id}/approve` | `APPROVED` + sesión reemplazo, en una transacción |
| 4 | Solicitudes | O rechaza con motivo | `POST /reschedule-requests/{id}/reject` | `REJECTED` |

**Regla de diseño:** aprobar requiere `expectedSessionVersion` **y** `expectedRequestVersion`. Si cualquiera cambió, no hay aprobación parcial: se avisa y se recarga. Y si el horario propuesto choca, la solicitud **sigue pendiente** — la UI no debe mostrarla como resuelta.

### J-M4 · Evaluar entregables

| # | Pantalla | Acción | Endpoint | Resultado |
|---|---|---|---|---|
| 0 | Participantes (M17) | Ve a quién acompaña esta oleada | `GET /admin/mentor-assignments` scopeado | ✅ CCR-012 |
| 1 | Cola (M11) | Ve lo pendiente | `GET /deliverables/pending-review` | `SUBMITTED` |
| 2 | Cola | **Toma** la revisión | `POST …/submissions/{submissionId}/start-review` | `UNDER_REVIEW` |
| 3 | Evaluar (M13) | Descarga y revisa los archivos | `GET …/files/{fileId}/download` | auditado |
| 4 | Evaluar | Escribe feedback + score 0–100 + rúbrica | `POST …/submissions/{submissionId}/evaluation` | `EVALUATED` |
| 5 | Evaluar | O devuelve con motivo | `POST …/submissions/{submissionId}/return` | `RETURNED` |
| 6 | Top 3 (M16) | Ordena candidatos de la consigna | `PUT /assignments/{assignmentId}/top-candidates` | ⚠️ regla provisional |

**Cambio de contrato:** tomar la revisión es explícito. Eso es bueno para el equipo — dos mentores ven quién está revisando qué — pero significa que la UI debe dejar claro que "Evaluar" primero **reserva** la revisión. El botón dice "Tomar y evaluar".

**La rúbrica viene de la consigna** (`assignment.rubric[]`), con su `label` y `maxScore`. Nada hardcodeado; cada `rubricScores[]` referencia un `criterionId`.

**Top 3:** el contrato marca `provisionalRule: true`. La pantalla lo dice con todas sus letras: la regla no está ratificada por Producto.

---

## 3. Admin / Proyectos

### J-A1 · Preparar la oleada — ✅ **desbloqueado** (CCR-012)

| # | Pantalla | Acción | Endpoint | Resultado |
|---|---|---|---|---|
| 1 | Oleadas (A6) | Crea la oleada del sector | `POST /admin/oleadas` + `Idempotency-Key` | `DRAFT` |
| 2 | Usuarios (A5) | Da de alta participantes y mentores con contraseña temporal | `POST /admin/users` | `mustChangePassword = true` |
| 3 | Enrollments (A7) | Inscribe participantes en la oleada | `POST /admin/enrollments` | `ACTIVE`, `FASE_0` o `FASE_1` |
| 4 | Asignaciones (A8) | Empareja mentor ↔ participante, o mentor ↔ oleada | `POST /admin/mentor-assignments` | `ACTIVE` |
| 4b | Asignaciones (A8) | Cierra una asignación al reasignar | `DELETE /admin/mentor-assignments/{id}?expectedVersion=` | `204` · queda `CLOSED` en el historial |
| 5 | Oleadas (A6) | Abre la oleada | `PATCH /admin/oleadas/{oleadaId}` `{status, expectedVersion}` | `OPEN` → `IN_PROGRESS` |
| 6 | Usuarios (A5) | Restablece acceso si alguien no logra entrar | `POST /admin/users/{userId}/password-reset` | Nueva temporal, sesiones revocadas |

**Este era el bloqueo del piloto y ya no lo es.** Dos detalles del contrato que cambian la pantalla:

- `MentorAssignment.enrollmentId` es **nullable**: una asignación puede cubrir la oleada completa o un participante concreto. La pantalla ofrece ambos modos, no asume 1:1.
- `Oleada.activeEnrollmentCount` da la ocupación directamente, así que el paso 3 muestra "18 de 30 cupos" sin pedir la lista.
- Reasignar **cierra** la asignación anterior con `DELETE` — semánticamente "cerrar", no "borrar": la fila queda `CLOSED` en el historial y se conserva quién acompañó a quién y en qué periodo.

### J-A2 · Supervisar la semana

| # | Pantalla | Acción | Endpoint |
|---|---|---|---|
| 1 | Dashboard (A1) | Ve el pulso operativo | `GET /dashboard/admin` |
| 2 | Sesiones (A2) | Filtra por oleada, estado, fase, rango | `GET /sessions` |
| 3 | Detalle (A3) | Interviene: reprograma, cancela, completa | `GET /sessions/{sessionId}` + acciones |
| 4 | Entregables (A4) | Ve cumplimiento por semana | `GET /deliverables` |

**Regla de diseño:** el dashboard responde una sola pregunta — *¿qué está en riesgo esta semana?* Los cuatro conteos del contrato (`activeUsers`, `upcomingSessions`, `pendingDeliverables`, `failedJobs`) alimentan esa lectura. Sin métricas inventadas.

`failedJobs` es el único que apunta a algo que aún no tiene pantalla de detalle (A8, Fase 4). Mientras tanto se muestra como número con la nota de que el detalle llega en Fase 4 — no como enlace roto.

---

## 4. Fuera del MVP

Se mapean para no bloquear después, pero no se diseñan ni se enlazan: graduación Fase 1 → 2, mentor par y checkpoints de Fase 2, funnel de búsqueda de empleo, postulación y scoring, Demo Day, certificados, apoyo emocional, IA de CV/LinkedIn, mensajería interna.

---

## 5. Preguntas abiertas para Proyectos

Ya no queda nada pendiente de contrato. Lo que sigue abierto es decisión de negocio:

1. **Top 3** — ¿por consigna, por semana o por oleada? El contrato tiene un baseline provisional por consigna con puestos 1–3 y lo marca `provisionalRule: true` (DEC-012 / CCR-008).
2. **Rúbricas reales** — ¿qué criterios usa cada consigna? El contrato los hace configurables; falta el contenido.
3. **Canal de notificación** — email, WhatsApp o ambos (DEC-020). Bloquea las plantillas y la recuperación autónoma de contraseña.
4. **Archivos** — tipos permitidos, tamaño máximo y retención. Hoy la UI muestra un placeholder heredado de la propuesta original.
5. **¿El participante ve su asistencia registrada** (`ATTENDED`/`ABSENT`) o es solo interna?
6. **Landing pública** — ¿parte del piloto implementable o solo diseño?
7. **Owner de Producto y de UAT.**

> **Quién crea las consignas ya está resuelto:** mentor y admin, ambos autorizados por el contrato. Era la pregunta 2 de la versión anterior de este documento.

> El cutoff de confirmación quedó resuelto en el contrato (`confirmationClosesAt = startsAt` en el piloto). Si Proyectos quiere cerrarla antes — por ejemplo 24 h antes, para que el mentor pueda reorganizarse —, es un cambio de valor, no de contrato.
