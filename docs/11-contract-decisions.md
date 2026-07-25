# 11 · Baseline de decisiones y respuesta a Contract Change Requests

Fecha: 2026-07-25
Owner técnico: Codex
Estado: baseline técnica lista para revisión de Producto/EDU-US.

Este documento cierra ambigüedades de implementación sin fingir una aprobación de negocio. Las decisiones marcadas `PENDIENTE_PRODUCTO` permiten continuar diseño técnico, pero no cruzar el Gate 0 hasta su ratificación.

## Estados

- `ACEPTADA_TECNICA`: forma parte del contrato base.
- `RECHAZADA_MVP`: no se construye en el piloto.
- `PENDIENTE_PRODUCTO`: tiene una opción técnica segura, pero necesita decisión de negocio.
- `DIFERIDA`: pertenece a una fase posterior.

## Decisiones P0

| ID | Estado | Decisión base | Consecuencia |
|---|---|---|---|
| DEC-001 | ACEPTADA_TECNICA | EDU-US es `organization`; `oleada` es cohorte, no tenant. | La autorización cruza la organización y después limita por rol, asignación y ownership. |
| DEC-002/003 | ACEPTADA_TECNICA | Roles y capacidades son relaciones múltiples. | `user_role`, `mentor_profile` y capacidades `SPECIALIST`/`PEER`; no `USER.role` ni `mentor_kind` único. |
| DEC-004 | ACEPTADA_TECNICA | El MVP incluye administración mínima. | Admin gestiona usuarios, oleadas, enrollments y asignaciones de mentor. |
| DEC-005 | ACEPTADA_TECNICA | Refresh sessions persistidas y revocables. | Refresh secreto hasheado, rotación, detección de reuse y revocación de familia. |
| DEC-006 | ACEPTADA_TECNICA | El portal usa cookies seguras. | Access/refresh en cookies `HttpOnly`, `Secure`, `SameSite`; protección CSRF. Bearer solo para clientes controlados futuros. |
| DEC-007 | ACEPTADA_TECNICA | Ciclo de sesión separado de confirmación y asistencia. | Session: `SCHEDULED/COMPLETED/CANCELLED/RESCHEDULED`; cada participante tiene confirmación y asistencia propias. |
| DEC-008/009 | ACEPTADA_TECNICA | Los traslapes se previenen y fase/periodo se validan también en DB. | Reservas de horario transaccionales; `CHECK` para Fase 1/semana y Fase 2/checkpoint. |
| DEC-010/011 | ACEPTADA_TECNICA | Entregable lógico con revisiones. | `deliverable_submission` conserva cada envío; archivos y evaluación apuntan a una revisión concreta. |
| DEC-012 | PENDIENTE_PRODUCTO | Baseline provisional: Top 3 por consigna (`assignment`), con puestos 1–3. | No se publicará como regla final hasta que Proyectos confirme el alcance. |
| DEC-013 | ACEPTADA_TECNICA | El participante puede solicitar reprogramación. | Recurso con `PENDING/APPROVED/REJECTED/CANCELLED`; aprobar crea la sesión reemplazo. |
| DEC-014 | ACEPTADA_TECNICA | DB/outbox es la autoridad. | BullMQ ejecuta/reintenta; n8n entrega integraciones periféricas; ambos son idempotentes. |
| DEC-015 | RECHAZADA_MVP | Job Tracking, mentoría par y pantallas futuras no entran al piloto. | No se crean tablas, rutas ni navegación activa de esos módulos. |
| DEC-016 | DIFERIDA | La IA se trabaja después del piloto con evaluación y revisión humana. | Ninguna “feature IA” decorativa entra al núcleo actual. |

## Decisiones operativas P1 adelantadas

| Tema | Baseline | Validación pendiente |
|---|---|---|
| Meeting | URL manual por sesión. | Confirmar si habrá Calendar/Meet después. |
| Password olvidado | Reset manual de admin con contraseña temporal y cambio obligatorio; revoca sesiones. | Elegir canal antes de habilitar recuperación autónoma. |
| Cambio de contraseña | Disponible para usuario autenticado. | Ninguna. |
| Métricas MVP | Conteos y horas derivados en backend; sin encuestas ni comparaciones históricas. | Validar nombres visibles con Producto. |
| Escala | Entero 0–100, sin conversión a estrellas. | Proyectos define rúbrica real por consigna. |
| Conflictos | Prevención estricta; no se crea panel de conflictos existentes. | Importadores futuros deberán usar la misma capa transaccional. |
| Notificaciones in-app | No habrá centro ni badge en el MVP. | Elegir canal externo inicial. |
| Archivos | Storage abstraído, metadatos seguros y scan state. | Tipos, tamaño, retención, antivirus y backup. |

## Respuesta formal a Claude Code

| CCR | Respuesta | Contrato acordado |
|---|---|---|
| CCR-001 | ACEPTADO | `session_reschedule_request` y endpoints de crear/decidir/cancelar. |
| CCR-002 | ACEPTADO | `GET /auth/me` incluye organización, roles, capacidades y enrollment activo con fase/semana/oleada. |
| CCR-003 | RECHAZADO_MVP | No existe “solicitar nueva sesión”. El panel muestra confirmaciones de asistencia o reprogramaciones pendientes. |
| CCR-004 | ACEPTADO_PARCIAL | Solo métricas derivables; se calculan server-side para no depender de listas paginadas. Sin satisfacción ni variaciones porcentuales. |
| CCR-005 | ACEPTADO | 0–100 en DB, API y UI; criterios configurables por assignment. |
| CCR-006 | ALTERNATIVA_ACEPTADA | Prevenir conflictos; retirar alerta de traslapes del MVP. |
| CCR-007 | ALTERNATIVA_ACEPTADA | Cambio autenticado + reset manual por admin. Retirar “Olvidé mi contraseña” hasta elegir canal. |
| CCR-008 | PENDIENTE_PRODUCTO | Diseñar provisionalmente Top 3 por assignment, puestos 1–3. No presentar la regla como aprobada. |
| CCR-009 | ALTERNATIVA_ACEPTADA | Sin campana/feed; mostrar próxima sesión y próximo vencimiento desde datos de dominio. |

## Reglas de coordinación resultantes

Claude puede continuar wireframes y componentes con estas decisiones. Cualquier cambio de estados, permisos, nombres de campos o rutas vuelve al protocolo CCR. Codex reflejará los cambios aprobados en modelo, API, OpenAPI, tipos compartidos y checklist.

## Respuesta a la reconciliación de diseño

| CCR | Respuesta | Contrato acordado |
|---|---|---|
| CCR-010 | ACEPTADO_PARCIAL | `SCHEDULE_CONFLICT` tiene payload tipado con recurso e intervalo ocupado. Solo incluye `conflictingSessionId` cuando el actor puede leer esa sesión. No calcula el próximo hueco en el MVP. |
| CCR-011 | ACEPTADO_TECNICA | En el piloto la confirmación cierra en `startsAt`. La API expone `confirmationClosesAt` y `canConfirm`; un intento tardío devuelve `422 CONFIRMATION_CLOSED`. |
| CCR-012 | ACEPTADO | OpenAPI incorpora CRUD operativo mínimo de oleadas, enrollments y mentor assignments, siempre scoped por organización. |

Precisiones de la revisión:

1. `GET /sessions?phase=` usa `SessionPhase`, solo `FASE_1|FASE_2`.
2. `GET /deliverables?status=` filtra el estado de `currentSubmissionId`.
3. `SessionSummary` incluye `confirmationSummary` con total/pending/confirmed/declined.
4. `GET /reschedule-requests` es scoped: participante ve las propias; mentor las de sesiones autorizadas; admin las de su organización.
5. `AdminDashboard.failedJobs` es informativo y no enlaza hasta Fase 4.
6. Tipos, tamaño y retención de archivos continúan `PENDIENTE_PRODUCTO`; cualquier texto visible es placeholder, no política.
7. Backend devuelve `error.code` estable; frontend redacta/localiza el mensaje y muestra `traceId` como código de soporte.

## Mapa de migración para el wireframe paralelo

| Referencia anterior | Contrato vigente |
|---|---|
| `POST /sessions/:id/confirm` | `PUT /sessions/:id/participants/me/confirmation` |
| attendance combinado `PENDING/CONFIRMED/ATTENDED/ABSENT` | `confirmationStatus` y `attendanceStatus` separados |
| `POST /deliverables/:id/files` | `POST /deliverables/:id/submissions/:submissionId/files` |
| `POST /deliverables/:id/submit` | `POST /deliverables/:id/submissions/:submissionId/submit` |
| `POST /deliverables/:id/evaluate` | `POST /deliverables/:id/submissions/:submissionId/evaluation` |
| `POST /deliverables/:id/return` | `POST /deliverables/:id/submissions/:submissionId/return` |
| `PATCH /deliverables/:id/top-candidate` | `PUT /assignments/:assignmentId/top-candidates` |
| conteos desde listas paginadas | `/dashboard/participant`, `/dashboard/mentor`, `/dashboard/admin` |
| nueve CCR “abiertos” | respuestas formales de este documento |

El contrato ejecutable está en `api/openapi.yaml`.

## Gate de producto aún abierto

1. ratificar Top 3;
2. definir rúbricas reales;
3. elegir canal de notificación;
4. definir tipos, tamaño y retención de archivos;
5. aprobar project charter, journeys y landing;
6. nombrar owner de Producto y de UAT.
